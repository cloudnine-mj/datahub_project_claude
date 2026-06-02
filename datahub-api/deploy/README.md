# Data Platform API — 배포 가이드

## 환경 구성 (3-Stage, 클러스터 단위 물리 격리)

스테이지는 **별도 GKE 클러스터**로 완전 분리됩니다. 같은 프로젝트(`lgair-dg-data-hub`) 안에서 리전은 `us-central1`.

| 스테이지 | 브랜치 | 클러스터 | 네임스페이스 | Helm release | API 진입점 | GCS bucket prefix |
|---|---|---|---|---|---|---|
| dev | `develop` | `lgair-datahub-dev` | `lgair-datahub` | `dh` | `dev.datahub.lgair-data.com/api/v1` | `lgair-dgdh-dev` |
| stg | `staging` | `lgair-datahub-stg` | `lgair-datahub` | `dh` | `stg.datahub.lgair-data.com/api/v1` | `lgair-dgdh-stg` |
| prd | `main` | `lgair-datahub-prd` | `lgair-datahub` | `dh` | `datahub.lgresearch.ai/api/v1` | `lgair-dgdh-prd` |

kubectl context (공유 워크스테이션에서 사용):

```bash
gcloud container clusters get-credentials lgair-datahub-dev  --region us-central1 --project lgair-dg-data-hub
gcloud container clusters get-credentials lgair-datahub-stg  --region us-central1 --project lgair-dg-data-hub
gcloud container clusters get-credentials lgair-datahub-prd  --region us-central1 --project lgair-dg-data-hub
```

⚠️ **공유 환경 주의**: `kubectl config use-context` 사용을 지양하고 명령마다 `--context gke_lgair-dg-data-hub_us-central1_lgair-datahub-{dev|stg|prd}` 플래그를 붙인다.

## GCS 버킷 네이밍 규칙

dev/stg/prd 클러스터는 같은 GCP project(`lgair-dg-data-hub`)를 사용하므로 GCS bucket prefix가 stage boundary입니다. `GCP_BUCKET_PREFIX`는 환경별 values 파일에서 반드시 `lgair-dgdh-{dev|stg|prd}`로 지정합니다.

레포를 생성하면 서버가 GCS 버킷을 `{prefix}-{gcs_key}` 형태로 만듭니다. `gcs_key`는 repo naming helper가 정규화합니다.

- group repo: `{normalized_group}--{normalized_repo}` → `lgair-dgdh-dev-nlp-lab--ner-dataset`
- personal repo: `{normalized_personal_namespace}--{normalized_repo}` → `lgair-dgdh-dev-karlo-lee--myrepo`
- legacy flat bucket: `{normalized_repo}` 형태는 cleanup/migration 대상으로만 취급합니다.
- stg/prd도 같은 suffix 규칙을 쓰되 prefix만 각각 `lgair-dgdh-stg`, `lgair-dgdh-prd`로 바꿉니다.

## 브랜치 → 배포 흐름

1. 개발자 `develop` 브랜치에 push → GitLab CI `build:develop` → 이미지 태그 `develop` + `$SHA`로 GAR push → `deploy:develop` → `lgair-datahub-dev` 클러스터에 Helm upgrade.
2. QA/검증 시 `develop` → `staging` 머지 → 동일 과정이 `lgair-datahub-stg` 에 반영.
3. 릴리즈 시 `staging` → `main` 머지 → `lgair-datahub-prd` 에 반영.

각 단계는 `.gitlab-ci.yml` 의 `rules: $CI_COMMIT_BRANCH == "<name>"` 으로만 트리거되며, 브랜치를 건너뛴 배포는 허용되지 않는다.

Runtime version은 `pyproject.toml`의 base version에서 CI가 산출한다. 기본값은 dev
`<base>.dev<CI_PIPELINE_IID>`, stg `<base>rc<CI_PIPELINE_IID>`, prd `<base>`이며,
운영 승인된 고정값이 필요하면 `DATAHUB_APP_VERSION` CI variable로 override한다.

## Helm 차트 파일 구조

```
deploy/helm/dp-chart/
├── Chart.yaml
├── values.yaml          # 모든 환경 공통 기본값 (민감 정보 빈 값)
├── values-dev.yaml      # develop 전용 오버라이드
├── values-staging.yaml  # staging 전용 오버라이드
├── values-prd.yaml      # main/prd 전용 오버라이드
├── values-ha.yaml       # HA 옵션 (고가용 레이아웃, 필요 시)
├── values-dev-hardening.yaml # dev 파일 전송 hardening 검증 전용 오버라이드
└── templates/
```

환경별 파일은 **네트워크/리소스/버킷 prefix/진입 host/runtime flag** 만 다르다. **민감 정보는 어느 파일에도 커밋하지 않는다.**

현재 launch-target 배포는 API control-plane, Redis, 공유 PostgreSQL, GCS data plane을 core runtime으로 봅니다. Unity Catalog와 MCP endpoint는 기본 dev/stg/prd 배포에서 비활성화합니다.

## File Transfer Rate Limit & Hardening Profile

파일 전송의 byte payload는 API가 중계하지 않고 GCS data plane이 처리합니다. API는
write-token, download-token, confirm, copy/delete 같은 control-plane 요청만 처리합니다.
운영 rate limit은 Helm ConfigMap을 통해 앱 환경변수로 전달합니다.

| Helm value | App env | 기본값 |
|---|---|---|
| `platform.config.RATE_LIMIT_WINDOW_SECONDS` | `RATE_LIMIT_WINDOW_SECONDS` | `60` |
| `platform.config.RATE_LIMIT_SESSION_REQUESTS` | `RATE_LIMIT_SESSION_REQUESTS` | `60` |
| `platform.config.RATE_LIMIT_TRANSFER_REQUESTS` | `RATE_LIMIT_TRANSFER_REQUESTS` | `120` |

prd/default 기준은 `replicaCount=3`, HPA `min=3`, `max=10`, CPU 70%입니다. shared dev는
보호값(`replicaCount=1`, HPA off, ingress `limit-rps=50`, `limit-connections=100`)을
유지합니다.

300명 규모 hardening 검증 시에만 dev에 아래 override를 추가합니다.

```bash
helm upgrade --install dh ./deploy/helm/dp-chart \
  --namespace lgair-datahub --create-namespace \
  --kube-context $CTX \
  -f ./deploy/helm/dp-chart/values.yaml \
  -f ./deploy/helm/dp-chart/values-dev.yaml \
  -f ./deploy/helm/dp-chart/values-dev-hardening.yaml \
  --set platform.secrets.DATABASE_URL=$PLATFORM_DATABASE_URL \
  --set platform.secrets.JWT_SECRET=$JWT_SECRET \
  --set platform.secrets.INTERNAL_SERVICE_SECRET=$INTERNAL_SERVICE_SECRET \
  --set platform.secrets.GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  --set platform.secrets.GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
  --wait --timeout 10m
```

이 override는 3 replicas, HPA min 3/max 10, ingress `limit-rps=200`,
`limit-connections=400`, transfer rate limit 600/min 조합을 재현하기 위한 검증용
profile이다. 일반 dev 배포에 상시 적용하지 않는다.

## 시크릿 관리 (GitLab CI/CD Variable + K8s Secret)

### 원칙

- values 파일에는 민감 정보 일절 커밋하지 않는다.
- CI가 `helm upgrade --set ...` 로 K8s Secret 으로 주입한다.
- GitLab CI/CD Variable은 **Environment scope** 로 환경별 다른 값을 같은 이름으로 관리한다.

### 필수 Variable 목록 (scope 별 dev/stg/prd 각각 값 등록)

| 이름 | 용도 | 비고 |
|---|---|---|
| `POSTGRES_ADMIN_PW` | PostgreSQL superuser | DB password |
| `PLATFORM_DB_PW` | `platform_db` 접속 password | |
| `WEB_DB_PW` | `management_db` 접속 password | web BFF와 공유 DB chart에서 사용 |
| `JWT_SECRET` | API 세션 서명 | 32자 이상 랜덤 |
| `INTERNAL_SERVICE_SECRET` | DPA↔DIA 서비스 JWT 서명 | 32자 이상 랜덤 |
| `GOOGLE_CLIENT_ID` | OAuth Client ID | 환경별 OAuth client 권장 |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret | 환경별 OAuth client 권장 |
| `LLM_API_KEY` | enrichment LLM | 선택 |
| `MICROSOFT_CLIENT_ID` / `_SECRET` / `TENANT_ID` | MS SSO | 선택 (전환 전까지 비움) |
| `GCP_SYSTEM_SA_EMAIL` | CAB 다운스코프 token 발급 SA | 선택 |

GitLab Project → Settings → CI/CD → Variables 에 등록. **Masked + Protected** 권장, Environment 필드를 `dev`/`stg`/`prd` 로 지정한다.

### 공유 `gcs-service-account-key` Secret

K8s 단에 미리 세팅되어야 한다 (helm chart에서 생성하지 않음):

```bash
CTX="gke_lgair-dg-data-hub_us-central1_lgair-datahub-dev"
kubectl --context $CTX -n lgair-datahub create secret generic gcs-service-account-key \
  --from-file=key.json=./deploy/helm/dp-chart/secrets/sa-key.json
```

prd 클러스터에서 쓰던 SA 키를 dev/stg 에서도 재활용할지, 환경별로 분리된 SA 를 만들지는 운영 합의 사항. 현재는 **같은 키 공유** 로 가되 필요 시 환경별 SA 로 분리한다.

## Ingress & TLS

- ingress-nginx v4.15.1 (각 클러스터마다 설치)
- cert-manager v1.20.1 + `ClusterIssuer letsencrypt-prod`
- Web과 API는 같은 환경별 host를 공유한다.
- API ingress는 `/api/v1` prefix만 `dh-platform` service로 라우팅한다.
- Web ingress의 `/` prefix와 같은 host를 쓰며, nginx ingress는 더 긴 `/api/v1` path를 우선 매칭한다.
- 인증서는 Web ingress와 같은 host/secret을 사용하고 자동 발급·갱신한다.

외부 허용 CIDR (사내망 기본):
```
203.247.149.40/29, 61.100.40.18/32, 10.1.251.0/24
165.85.218.127/32, 165.85.218.128/32
140.209.203.20/32, 140.209.203.114/32
134.231.208.126/32, 134.231.208.21/32
34.56.23.209/32, 34.69.21.196/32, 34.44.90.1/32
210.98.176.131/32, 10.128.0.102/32
35.222.144.28/32, 35.222.221.89/32, 34.170.180.252/32
```

CIDR 변경 시 `광호님(이광호)` 확인 후 ingress-nginx 업그레이드 진행.

## 로컬에서 수동 배포 (디버깅용)

```bash
# 환경변수에 시크릿 세팅
export POSTGRES_ADMIN_PW=...
export PLATFORM_DB_PW=...
export WEB_DB_PW=...
# ... (위 표의 나머지 변수들)

# dev 배포
CTX="gke_lgair-dg-data-hub_us-central1_lgair-datahub-dev"
DB_HOST="dh-db-postgresql.lgair-datahub-db.svc.cluster.local"
PLATFORM_DATABASE_URL="postgresql://platform:${PLATFORM_DB_PW}@${DB_HOST}:5432/platform_db"

# 공유 DB chart 배포 또는 갱신
helm upgrade --install dh-db ./deploy/helm/db-chart \
  --namespace lgair-datahub-db --create-namespace \
  --kube-context $CTX \
  -f ./deploy/helm/db-chart/values.yaml \
  -f ./deploy/helm/db-chart/values-dev.yaml \
  --set postgresql.auth.postgresPassword=$POSTGRES_ADMIN_PW \
  --set postgresql.auth.platformPassword=$PLATFORM_DB_PW \
  --set postgresql.auth.webPassword=$WEB_DB_PW \
  --wait --timeout 10m

# API chart 배포 또는 갱신
helm upgrade --install dh ./deploy/helm/dp-chart \
  --namespace lgair-datahub --create-namespace \
  --kube-context $CTX \
  -f ./deploy/helm/dp-chart/values.yaml \
  -f ./deploy/helm/dp-chart/values-dev.yaml \
  --set platform.secrets.DATABASE_URL=$PLATFORM_DATABASE_URL \
  --set platform.secrets.JWT_SECRET=$JWT_SECRET \
  --set platform.secrets.INTERNAL_SERVICE_SECRET=$INTERNAL_SERVICE_SECRET \
  --set platform.secrets.GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  --set platform.secrets.GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
  --set platform.config.MCP_ENABLED=false \
  --set platform.config.OTEL_ENABLED=false \
  --set unityCatalog.enabled=false \
  --wait --timeout 10m
```

`values-dev.yaml` 을 `values-staging.yaml` / `values-prd.yaml` 로 교체하고 `$CTX` 를 해당 클러스터로 바꾸면 각각 배포.

## Legacy runtime cleanup after stg/prd upgrade

Old stg/prd releases may still contain launch-target-excluded resources from
the storage-engine PoC line (`dh-lakefs`, `dh-unity-catalog`, in-chart
PostgreSQL). The current Helm release disables those components, but verify and
clean up leftovers after the first upgrade:

```bash
CTX=gke_lgair-dg-data-hub_us-central1_lgair-datahub-stg \
  deploy/scripts/cleanup-legacy-runtime.sh

CTX=gke_lgair-dg-data-hub_us-central1_lgair-datahub-stg APPLY=1 \
  deploy/scripts/cleanup-legacy-runtime.sh
```

PVC deletion is intentionally gated:

```bash
CTX=gke_lgair-dg-data-hub_us-central1_lgair-datahub-stg APPLY=1 DELETE_PVC=1 \
  deploy/scripts/cleanup-legacy-runtime.sh
```

Run the same commands with the prd context only after the replacement shared DB
and smoke checks are verified.

배포 후에는 rollout과 hosted process health를 같이 확인합니다.

```bash
kubectl --context $CTX -n lgair-datahub rollout status deployment/dh-platform --timeout=5m
kubectl --context $CTX -n lgair-datahub exec deployment/dh-platform -- \
  python -c 'import os, urllib.request; assert os.getenv("MCP_ENABLED", "").lower() == "false"; print(urllib.request.urlopen("http://127.0.0.1:8080/api/v1/health", timeout=10).read().decode())'
```

## PostgreSQL Internal LoadBalancer 방화벽

PostgreSQL을 Internal LB(`cloud.google.com/load-balancer-type: Internal`) 로 노출하는 경우 (예: 외부 BI 도구 접근) 아래 방화벽 규칙을 추가한다.

```bash
gcloud compute firewall-rules create allow-postgresql-internal \
  --project=lgair-dg-data-hub \
  --network=default \
  --direction=INGRESS \
  --action=ALLOW \
  --rules=tcp:5432 \
  --source-ranges="10.0.0.0/8,203.247.149.40/29,61.100.40.18/32,10.1.251.0/24" \
  --target-tags=gke-lgair-datahub-<stage> \
  --description="Allow PostgreSQL access from internal/VPN networks only"
```

`<stage>` 에 `dev`/`stg`/`prd` 를 넣어 환경별 규칙을 따로 만든다.

## 담당자

| 역할 | 담당 |
|------|------|
| IaC 설계·관리 | 도윤 (datahub-qa) |
| 배포 실행 | 예나, 민재, 시우 |
