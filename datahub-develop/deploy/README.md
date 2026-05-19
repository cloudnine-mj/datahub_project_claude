# DataHub 웹 포털 — 배포 가이드

## 환경 구성 (3-Stage, 클러스터 단위 물리 격리)

웹 포털은 `datahub-api` 와 **같은 GKE 클러스터들**을 공유한다 (같은 네임스페이스 `lgair-datahub` 안에 Helm release `dh-web` 로 배포).

| 스테이지 | 브랜치 | 클러스터 | 네임스페이스 | Helm release | 도메인 |
|---|---|---|---|---|---|
| dev | `develop` | `lgair-datahub-dev` | `lgair-datahub` | `dh-web` | `dev.datahub.lgair-data.com` |
| stg | `staging` | `lgair-datahub-stg` | `lgair-datahub` | `dh-web` | `stg.datahub.lgair-data.com` |
| prd | `main` | `lgair-datahub-prd` | `lgair-datahub` | `dh-web` | `datahub.lgair-data.com` |

kubectl context:

```bash
gcloud container clusters get-credentials lgair-datahub-dev  --region us-central1 --project lgair-dg-data-hub
gcloud container clusters get-credentials lgair-datahub-stg  --region us-central1 --project lgair-dg-data-hub
gcloud container clusters get-credentials lgair-datahub-prd  --region us-central1 --project lgair-dg-data-hub
```

⚠️ **공유 환경 주의**: `kubectl config use-context` 지양. 명령마다 `--context gke_lgair-dg-data-hub_us-central1_lgair-datahub-{dev|stg|prd}` 플래그 사용.

## 브랜치 → 배포 흐름

1. 개발자가 `develop` 브랜치에 push → GitLab CI `build:develop` + `deploy:develop` → `lgair-datahub-dev` 클러스터 `dh-web` release 갱신.
2. `staging` 머지 → `lgair-datahub-stg`.
3. `main` 머지 → `lgair-datahub-prd`.

이미지 태그:
- dev 빌드: `us-central1-docker.pkg.dev/.../web:develop` + `:$CI_COMMIT_SHA`
- stg 빌드: `:staging` + `:$CI_COMMIT_SHA`
- prd 빌드: `:latest` + `:$CI_COMMIT_SHA`

## Helm 차트 파일 구조

```
deploy/helm/web-chart/
├── Chart.yaml
├── values.yaml           # 모든 환경 공통 기본값
├── values-dev.yaml       # develop 전용 오버라이드
├── values-staging.yaml   # staging 전용 오버라이드
├── values-prd.yaml       # main/prd 전용 오버라이드
└── templates/
```

환경별 파일은 **도메인/리소스/레플리카/이미지 태그** 만 다르다. **민감 정보는 어느 파일에도 커밋하지 않는다.**

## 시크릿 관리 (GitLab CI/CD Variable + K8s Secret)

CI 가 `helm upgrade --set ...` 로 K8s Secret 으로 주입한다. GitLab CI/CD Variable 은 **Environment scope** 로 환경별 다른 값을 같은 이름으로 관리.

### 필수 Variable 목록

scope 별(`dev`/`stg`/`prd`) 각각 값 등록.

| 이름 | 용도 | 비고 |
|---|---|---|
| `POSTGRES_ADMIN_PW` | PostgreSQL superuser | |
| `WEB_DB_PW` | 포털 user (`management_admin`) password | |
| `NEXTAUTH_SECRET` | NextAuth 서명 시크릿 | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | 환경별 OAuth client 권장 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | |

GitLab Project → Settings → CI/CD → Variables 에서 등록. **Masked + Protected** 권장, Environment 필드를 `dev`/`stg`/`prd` 로 지정.

## 클러스터 부트스트랩 (신규 클러스터)

`ingress-nginx`, `cert-manager`, `ClusterIssuer letsencrypt-prod`, `lgair-datahub` 네임스페이스는 애플리케이션 배포 **전에** 미리 준비되어야 한다. 공통 매니페스트/값은 **`datahub-api/deploy/cluster-bootstrap/`** 에 커밋되어 있으며, 이 문서는 동일 절차를 참조만 한다.

`datahub-api/deploy/cluster-bootstrap/README.md` 참고.

## 로컬 수동 배포 (디버깅용)

```bash
# 환경변수 준비
export POSTGRES_ADMIN_PW=...
export WEB_DB_PW=...
export NEXTAUTH_SECRET=...
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...

# dev 배포
CTX="gke_lgair-dg-data-hub_us-central1_lgair-datahub-dev"

helm upgrade --install dh-web ./deploy/helm/web-chart \
  --namespace lgair-datahub --create-namespace \
  --kube-context $CTX \
  -f ./deploy/helm/web-chart/values.yaml \
  -f ./deploy/helm/web-chart/values-dev.yaml \
  --set postgresql.auth.postgresPassword=$POSTGRES_ADMIN_PW \
  --set postgresql.auth.webPassword=$WEB_DB_PW \
  --set web.secrets.NEXTAUTH_SECRET=$NEXTAUTH_SECRET \
  --set web.secrets.GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID \
  --set web.secrets.GOOGLE_CLIENT_SECRET=$GOOGLE_CLIENT_SECRET
```

`values-dev.yaml` 을 `values-staging.yaml` / `values-prd.yaml` 로 교체하고 `$CTX` 를 해당 클러스터로 바꾸면 각각 배포.

## 담당자

| 역할 | 담당 |
|------|------|
| IaC 설계·관리 | 도윤 (datahub-qa) |
| 배포 실행·UX 검증 | 라온 (datahub-frontend) |
