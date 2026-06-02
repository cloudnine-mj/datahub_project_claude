#!/usr/bin/env bash
set -euo pipefail

# Remove launch-target-excluded resources that may remain after upgrading old
# stg/prd Helm releases. Defaults to dry-run; set APPLY=1 to delete.

CTX="${CTX:?set CTX to a Kubernetes context, for example gke_..._lgair-datahub-stg}"
NS="${NS:-lgair-datahub}"
APPLY="${APPLY:-0}"
DELETE_PVC="${DELETE_PVC:-0}"

legacy_workloads=(
  deployment/dh-lakefs
  deployment/dh-unity-catalog
  deployment/dh-postgresql
  deployment/dh-web-postgresql
)
legacy_services=(
  service/dh-lakefs
  service/dh-unity-catalog
  service/dh-postgresql
  service/dh-web-postgresql
)
legacy_ingresses=(
  ingress/dh-lakefs
  ingress/dh-unity-catalog
)
legacy_config=(
  configmap/dh-lakefs-config
  configmap/dh-unity-catalog-config
  secret/dh-lakefs-secret
  secret/dh-unity-catalog-secret
)
legacy_pvcs=(
  persistentvolumeclaim/data-dh-postgresql-0
  persistentvolumeclaim/data-dh-web-postgresql-0
)

delete_args=(--context "$CTX" -n "$NS" delete --ignore-not-found)
if [[ "$APPLY" != "1" ]]; then
  delete_args+=(--dry-run=server -o name)
fi

echo "[cleanup] context=$CTX namespace=$NS apply=$APPLY delete_pvc=$DELETE_PVC"
kubectl "${delete_args[@]}" \
  "${legacy_workloads[@]}" \
  "${legacy_services[@]}" \
  "${legacy_ingresses[@]}" \
  "${legacy_config[@]}"

if [[ "$DELETE_PVC" == "1" ]]; then
  kubectl "${delete_args[@]}" "${legacy_pvcs[@]}"
else
  echo "[cleanup] PVC deletion skipped. Set DELETE_PVC=1 after DB migration/backups are verified."
fi
