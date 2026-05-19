#!/usr/bin/env bash
# GitLab Runner Registration Script for datahub K8s Cluster
# Usage: export GITLAB_PAT="glpat-xxxx" && bash register-runner.sh
#
# Prerequisites:
#   - GITLAB_PAT with 'create_runner' + 'api' scopes
#   - kubectl configured for gke_lgair-dg-data-hub_us-central1_lgair-datahub-prd
#   - helm v3+ installed

set -euo pipefail

# ── Configuration ──
GITLAB_URL="https://gitlab.lgresearch.ai"
GROUP_ID=1408
RUNNER_TAG="datahub-k8s"
RUNNER_DESC="datahub-k8s-runner"
NAMESPACE="gitlab-runner"
SECRET_NAME="gitlab-runner-secret"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALUES_FILE="${SCRIPT_DIR}/values.yaml"
RBAC_FILE="${SCRIPT_DIR}/rbac-deployer.yaml"

# ── Prerequisite Checks ──
if [[ -z "${GITLAB_PAT:-}" ]]; then
  echo "ERROR: GITLAB_PAT environment variable is not set."
  echo "Create a PAT with 'create_runner' + 'api' scopes at:"
  echo "  ${GITLAB_URL}/-/user_settings/personal_access_tokens"
  echo "Then: export GITLAB_PAT=\"glpat-xxxx\""
  exit 1
fi

command -v kubectl >/dev/null 2>&1 || { echo "ERROR: kubectl not found"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "ERROR: helm not found"; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "ERROR: curl not found"; exit 1; }

echo "=== GitLab Runner Registration ==="
echo "GitLab URL: ${GITLAB_URL}"
echo "Group ID: ${GROUP_ID}"
echo "Runner Tag: ${RUNNER_TAG}"
echo "K8s Namespace: ${NAMESPACE}"

# ── Step 1: Create namespace ──
echo ""
echo "[1/6] Creating namespace '${NAMESPACE}'..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# ── Step 2: Register runner via GitLab API ──
echo "[2/6] Registering group runner via GitLab API..."
RESPONSE=$(curl --silent --fail --request POST \
  --url "${GITLAB_URL}/api/v4/user/runners" \
  --header "PRIVATE-TOKEN: ${GITLAB_PAT}" \
  --header "Content-Type: application/json" \
  --data "{
    \"runner_type\": \"group_type\",
    \"group_id\": ${GROUP_ID},
    \"tag_list\": [\"${RUNNER_TAG}\"],
    \"run_untagged\": false,
    \"description\": \"${RUNNER_DESC}\",
    \"maximum_timeout\": 7200
  }")

RUNNER_ID=$(echo "${RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RUNNER_TOKEN=$(echo "${RESPONSE}" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

echo "  Runner ID: ${RUNNER_ID}"
echo "  Token: ${RUNNER_TOKEN:0:4}******* (masked)"

# ── Step 3: Store token as K8s Secret ──
echo "[3/6] Storing runner token as K8s Secret..."
kubectl create secret generic "${SECRET_NAME}" \
  --namespace "${NAMESPACE}" \
  --from-literal=runner-token="${RUNNER_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

# ── Step 4: Install Helm chart ──
echo "[4/6] Installing GitLab Runner Helm chart..."
helm repo add gitlab https://charts.gitlab.io 2>/dev/null || true
helm repo update gitlab

helm upgrade --install gitlab-runner gitlab/gitlab-runner \
  --namespace "${NAMESPACE}" \
  --values "${VALUES_FILE}" \
  --wait \
  --timeout 3m

# ── Step 5: Apply deployer RBAC ──
echo "[5/6] Applying deployer RBAC..."
kubectl apply -f "${RBAC_FILE}"

# ── Step 6: Verify ──
echo "[6/6] Verifying installation..."
echo ""
echo "--- Pod Status ---"
kubectl get pods -n "${NAMESPACE}" -l app=gitlab-runner
echo ""
echo "--- Runner Status (GitLab) ---"
sleep 10
glab api "runners/${RUNNER_ID}" --hostname "$(echo ${GITLAB_URL} | sed 's|https://||')" 2>/dev/null \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f\"  ID: {d['id']}\")
print(f\"  Status: {d['status']}\")
print(f\"  Tags: {d.get('tag_list', [])}\")
print(f\"  Type: {d.get('runner_type', 'N/A')}\")
" || echo "  (GitLab API check failed — runner may need more time to connect)"

echo ""
echo "=== Installation Complete ==="
echo "Runner ID: ${RUNNER_ID}"
echo ""
echo "To rollback:"
echo "  helm uninstall gitlab-runner -n ${NAMESPACE}"
echo "  kubectl delete namespace ${NAMESPACE}"
echo "  # Delete runner from GitLab:"
echo "  # curl --request DELETE --header \"PRIVATE-TOKEN: \$GITLAB_PAT\" \"${GITLAB_URL}/api/v4/runners/${RUNNER_ID}\""
