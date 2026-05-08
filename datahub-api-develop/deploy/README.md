# Data Platform API — 배포 가이드

## 환경 구성 (3-Stage, 클러스터 단위 물리 격리)

스테이지는 **별도 GKE 클러스터**로 완전 분리됩니다. 같은 프로젝트(`lgair-dg-data-hub`) 안에서 리전은 `us-central1`.

| 스테이지 | 브랜치 | 클러스터 | 네임스페이스 | Helm release | API 도메인 | GCS bucket prefix |
|---|---|---|---|---|---|---|
| dev | `develop` | `lgair-datahub-dev` | `lgair-datahub` | `dh` | `api-dev.datahub.lgair-data.com` | `lgair-dgdh-dev` |
| stg | `staging` | `lgair-datahub-stg` | `lgair-datahub` | `dh` | `api-stg.datahub.lgair-data.com` | `lgair-dgdh-stg` |
| prd | `main` | `lgair-datahub-prd` | `lgair-datahub` | `dh` | `api.datahub.lgair-data.com` | `lgair-dgdh-prd` |

kubectl context (공유 워크스테이션에서 사용):

```bash
gcloud container clusters get-credentials lgair-datahub-dev  --region us-central1 --project lgair-dg-data-hub
gcloud container clusters get-credentials lgair-datahub-stg  --region us-central1 --project lgair-dg-data-hub
gcloud container clusters get-credentials lgair-datahub-prd  --region us-central1 --project lgair-dg-data-hub
```

⚠️ **공유 환경 주의**: `kubectl config use-context` 사용을 지양하고 명령마다 `--context gke_lgair-dg-data-hub_us-central1_lgair-datahub-{dev|stg|prd}` 플래그를 붙인다.

## GCS 버킷 네이밍 규칙

레포를 생성하면 서버가 GCS 버킷을 `{prefix}-{repo_name}` 형태로 만든다 (`app/services/gcs.py`). prefix는 GCS 전역 네임스페이스에서 중복을 피하기 위해 **환경별로 분리**된다.

- dev : `lgair-dgdh-dev-{repo_name}`
- stg : `lgair-dgdh-stg-{repo_name}`
- prd : `lgair-dgdh-prd-{repo_name}`

## 브랜치 → 배포 흐름

1. 개발자 `develop` 브랜치에 push → GitLab CI `build:develop` → 이미지 태그 `develop` + `$SHA`로 GAR push → `deploy:develop` → `lgair-datahub-dev` 클러스터에 Helm upgrade.
2. QA/검증 시 `develop` → `staging` 머지 → 동일 과정이 `lgair-datahub-stg` 에 반영.
3. 릴리즈 시 `staging` → `main` 머지 → `lgair-datahub-prd` 에 반영.

각 단계는 `.gitlab-ci.yml` 의 `rules: $CI_COMMIT_BRANCH == "<name>"` 으로만 트리거되며, 브랜치를 건너뛴 배포는 허용되지 않는다.

## Helm 차트 파일 구조

```
deploy/helm/dp-chart/
├── Chart.yaml
├── values.yaml          # 모든 환경 공통 기본값 (민감 정보 빈 값)
├── values-dev.yaml      # develop 전용 오버라이드
├── values-staging.yaml  # staging 전용 오버라이드
├── values-prd.yaml      # main/prd 전용 오버라이드
├── values-ha.yaml       # HA 옵션 (고가용 레이아웃, 필요 시)
└── templates/
```

환경별 파일은 **네트워크/리소스/버킷 prefix/도메인** 만 다르다. **민감 정보는 어느 파일에도 커밋하지 않는다.**

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
| `LAKEFS_DB_PW` | `lakefs_db` 접속 password | |
| `UC_DB_PW` | `uc_db` 접속 password | |
| `JWT_SECRET` | API 세션 서명 | 32자 이상 랜덤 |
| `INTERNAL_SERVICE_SECRET` | DPA↔DIA 서비스 JWT 서명 | 32자 이상 랜덤 |
| `GOOGLE_CLIENT_ID` | OAuth Client ID | 환경별 OAuth client 권장 |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret | 환경별 OAuth client 권장 |
| `LAKEFS_ACCESS_KEY_ID` | LakeFS admin 키 | |
| `LAKEFS_SECRET_ACCESS_KEY` | LakeFS admin 시크릿 | |
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
- 도메인은 ingress 리소스의 host 에 정의, 인증서는 자동 발급·갱신

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
# ... (위 표의 나머지 변수들)

# dev 배포
CTX="gke_lgair-dg-data-hub_us-central1_lgair-datahub-dev"

LAKEFS_CONFIG=$(cat <<EOF
database:
  type: postgres
  postgres:
    connection_string: postgres://lakefs:${LAKEFS_DB_PW}@dh-postgresql:5432/lakefs_db?sslmode=disable
blockstore:
  type: gs
EOF
)

helm upgrade --install dh ./deploy/helm/dp-chart \
  --namespace lgair-datahub --create-namespace \
  --kube-context $CTX \
  -f ./deploy/helm/dp-chart/values.yaml \
  -f ./deploy/helm/dp-chart/values-dev.yaml \
  --set postgresql.auth.postgresPassword=$POSTGRES_ADMIN_PW \
  --set postgresql.auth.platformPassword=$PLATFORM_DB_PW \
  --set postgresql.auth.lakefsPassword=$LAKEFS_DB_PW \
  --set postgresql.auth.ucPassword=$UC_DB_PW \
  --set platform.secrets.JWT_SECRET=$JWT_SECRET \
  --set platform.secrets.INTERNAL_SERVICE_SECRET=$INTERNAL_SERVICE_SECRET \
  --set platform.secrets.GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  --set platform.secrets.GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET \
  --set platform.secrets.LAKEFS_ACCESS_KEY_ID=$LAKEFS_ACCESS_KEY_ID \
  --set platform.secrets.LAKEFS_SECRET_ACCESS_KEY=$LAKEFS_SECRET_ACCESS_KEY \
  --set-string lakefs.lakefsConfig="$LAKEFS_CONFIG"
```

`values-dev.yaml` 을 `values-staging.yaml` / `values-prd.yaml` 로 교체하고 `$CTX` 를 해당 클러스터로 바꾸면 각각 배포.

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
