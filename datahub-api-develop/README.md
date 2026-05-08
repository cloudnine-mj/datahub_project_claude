# Data Platform Service (datahub-api)

LakeFS · Unity Catalog · GCS 를 통합하는 Data Governance 백엔드 API. 웹 포털(`datahub`) 및 파이썬 SDK(`lgair-datahub`) 가 이 API 만을 호출하는 Thin-client 구조.

## 주요 담당

| 담당자 | 역할 | 커밋 user.name |
|--------|------|---------------|
| 예나 (Yena)   | 플랫폼 Tech Lead       | `Yena (datahub-techlead)` |
| 민재 (Minjae) | 백엔드 / 보안           | `Minjae (datahub-backend)` |
| 시우 (Siu)    | 백엔드 / 오브젝트 스토리지 | `Siu (datahub-storage)` |
| 도윤 (Doyun)  | IaC · QA              | `Doyun (datahub-qa)` |

> 커밋 시: `git config user.name "Minjae (datahub-backend)"  # 본인 담당에 맞게 변경`

## 기능

- **레포 · 브랜치** (`/api/v1/repos`, `/api/v1/versioning`) — LakeFS 기반 버전 관리, 커밋/브랜치/태그 조작
- **파일 입출력** (`/api/v1/files`) — GCS direct upload / multipart resumable / signed-url 다운로드
- **카탈로그** (`/api/v1/catalog`, `/api/v1/lineage`) — Unity Catalog 메타데이터, 컬럼 레벨 lineage
- **인증 · 조직 · 권한** (`/api/v1/auth`, `/organizations`, `/permissions`) — Google/MS SSO, JWT 세션, RBAC
- **관측** (`/api/v1/metrics`, OTLP export) — Prometheus + OpenTelemetry
- **MCP server** (`mcp_app/`) — LLM agent 가 동일 API 를 MCP 프로토콜로 호출

## 기술 스택

- **언어/프레임워크**: Python 3.12, FastAPI, SQLAlchemy 2.x (async), Alembic
- **영속성**: PostgreSQL, Redis (rate-limit/cache), LakeFS (데이터 버전), Unity Catalog
- **오브젝트**: Google Cloud Storage (SA 기반 + signed URL)
- **배포**: Docker → GAR → Helm → GKE (3-stage: dev/stg/prd)
- **의존성 관리**: `uv` (pyproject.toml)

## 로컬 개발 환경 세팅

```bash
# 1) 파이썬 가상환경 + 의존성
uv venv --python 3.12
source .venv/bin/activate
uv pip install -e ".[dev]"

# 2) 필요한 외부 서비스 (docker-compose 또는 원격 인스턴스)
#    - PostgreSQL  (platform_db, lakefs_db, uc_db)
#    - LakeFS      (ex: lakefs:0.115 → gs:// blockstore)
#    - Unity Catalog server
#    - Redis       (선택; 미설정 시 rate-limit 비활성)

# 3) 환경 변수 (.env 권장, app/config.py:Settings 참고)
export DATABASE_URL=postgresql+psycopg2://...
export LAKEFS_ENDPOINT=http://localhost:8000
export LAKEFS_ACCESS_KEY_ID=...
export LAKEFS_SECRET_ACCESS_KEY=...
export JWT_SECRET="$(openssl rand -hex 32)"
export GOOGLE_CLIENT_ID=...
export GOOGLE_CLIENT_SECRET=...
# ... (전체 목록: app/config.py)

# 4) DB 마이그레이션
alembic upgrade head

# 5) 개발 서버 실행
uvicorn app.main:app --reload --port 8000
```

OpenAPI UI: `http://localhost:8000/docs`

## 테스트

```bash
pytest -q                    # 전체 단위 테스트
pytest tests/e2e -q          # 외부 의존 포함 (실 LakeFS/GCS 필요)
ruff check app tests         # 린트
```

외부 의존이 많은 로직은 로컬 mock 보다 **dev 환경 API 에 대한 스모크 테스트**를 선호한다.

## 디렉토리 구조

```
app/
├── main.py              FastAPI 진입점
├── config.py            Settings (pydantic-settings, env 기반)
├── routers/             API 엔드포인트 (버전 prefix /api/v1)
├── services/            외부 서비스 클라이언트 (lakefs, gcs, uc, metrics, tracing, rate_limit)
├── schemas/             Pydantic 요청/응답 모델
├── models/              SQLAlchemy ORM 모델
├── maintenance/         주기 작업 (업로드 세션 cleanup 등)
└── workers/             백그라운드 작업

alembic/                 DB 마이그레이션
mcp_app/                 MCP 서버 (LLM agent 용 프로토콜 래퍼)
tests/                   단위 + e2e 테스트
deploy/                  Docker · Helm · K8s · Cluster bootstrap
```

## 배포

CI/CD 파이프라인(`.gitlab-ci.yml`)이 브랜치 기반으로 3-stage 클러스터에 자동 배포한다.

| 브랜치 | 클러스터 | API 도메인 |
|---|---|---|
| `develop` | `lgair-datahub-dev` | `api-dev.datahub.lgair-data.com` |
| `staging` | `lgair-datahub-stg` | `api-stg.datahub.lgair-data.com` |
| `main`    | `lgair-datahub-prd` | `api.datahub.lgair-data.com` |

상세 절차: [`deploy/README.md`](deploy/README.md), 신규 클러스터 부트스트랩: [`deploy/cluster-bootstrap/README.md`](deploy/cluster-bootstrap/README.md).

## 관련 레포

- **웹 포털**: [`data-governance-public/datahub`](https://gitlab.lgresearch.ai/data-governance-public/datahub) — 이 API 를 호출하는 Next.js 프론트엔드
- **파이썬 SDK**: `lgair-datahub` (GitLab PyPI 레지스트리 배포) — CLI/노트북에서 쓰는 thin client
