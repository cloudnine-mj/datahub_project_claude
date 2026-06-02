# DataHub API (datahub-api)

DataHub control-plane API. 웹 포털(`datahub`), CLI, 파이썬 SDK(`lgair-datahub`)가 호출하는 인증, 저장소 메타데이터, 권한, 파일 전송 제어 API를 담당합니다.

## 주요 담당

| 담당자 | 역할 | 커밋 user.name |
|--------|------|---------------|
| 예나 (Yena)   | 플랫폼 Tech Lead       | `Yena (datahub-techlead)` |
| 민재 (Minjae) | 백엔드 / 보안           | `Minjae (datahub-backend)` |
| 시우 (Siu)    | 백엔드 / 오브젝트 스토리지 | `Siu (datahub-storage)` |
| 도윤 (Doyun)  | IaC · QA              | `Doyun (datahub-qa)` |

> 커밋 시: `git config user.name "Minjae (datahub-backend)"  # 본인 담당에 맞게 변경`

## 기능

- **저장소 메타데이터** (`/api/v1/repos`) — owner/repo, visibility, repository permission 관리
- **파일 전송 제어** (`/api/v1/files`) — GCS/CAB 기반 파일 전송 경로
- **인증 · 조직 · 권한** (`/api/v1/auth`, `/organizations`, `/permissions`) — Google/MS SSO, JWT 세션, Bearer access token, RBAC
- **관측** (`/api/v1/metrics`, OTLP export) — Prometheus + OpenTelemetry

## 기술 스택

- **언어/프레임워크**: Python 3.12, FastAPI, SQLAlchemy 2.x (async), Alembic
- **영속성**: PostgreSQL, Redis (rate-limit/cache/session)
- **오브젝트**: Google Cloud Storage, CAB downscoped token
- **배포**: Docker → GAR → Helm → GKE (3-stage: dev/stg/prd)
- **의존성 관리**: `uv` (pyproject.toml)

## 로컬 개발 환경 세팅

Launch-target 로컬 개발은 FastAPI 서버와 PostgreSQL을 실제로 띄운 뒤 HTTP 요청으로 검증합니다. 파일 전송은 GCS/CAB 기반 control-plane 계약으로 검증하고, 저장소 버전 관리 PoC 경로는 런타임에서 제거했습니다.

```bash
uv venv --python 3.12
source .venv/bin/activate
uv pip install -e ".[dev]"

scripts/dev-api up
scripts/dev-api migrate
scripts/dev-api server
```

다른 터미널에서 실제 HTTP smoke check를 실행합니다.

```bash
scripts/dev-api smoke
```

OpenAPI UI: `http://localhost:18080/docs`

상세 로컬 루프는 [`docs/local-development.md`](docs/local-development.md), runtime 의존성 기준은 [`docs/runtime-dependency-matrix.md`](docs/runtime-dependency-matrix.md)를 참고합니다. 코드 에이전트 작업 규칙은 [`AGENTS.md`](AGENTS.md)와 [`CLAUDE.md`](CLAUDE.md)에 둡니다.

같은 머신에서 포트가 충돌하면 `DATAHUB_DEV_API_PORT`, `DATAHUB_DEV_POSTGRES_PORT`, `DATAHUB_DEV_REDIS_PORT`, `DATAHUB_DEV_COMPOSE_PROJECT`로 분리합니다.

## 테스트

```bash
scripts/dev-api smoke        # 로컬 서버 + PostgreSQL HTTP smoke
pytest -q                    # 전체 단위 테스트
ruff check app tests         # 린트
```

외부 의존이 많은 로직은 로컬 mock 보다 **dev 환경 API 에 대한 스모크 테스트**를 선호한다.

## 디렉토리 구조

```
app/
├── main.py              FastAPI 진입점
├── config.py            Settings (pydantic-settings, env 기반)
├── routers/             API 엔드포인트 (버전 prefix /api/v1)
├── services/            서비스 클라이언트와 cross-cutting 로직 (gcs, metrics, tracing, rate_limit 등)
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

| 브랜치 | 클러스터 | API 진입점 | GCS bucket prefix |
|---|---|---|---|
| `develop` | `lgair-datahub-dev` | `dev.datahub.lgair-data.com/api/v1` | `lgair-dgdh-dev` |
| `staging` | `lgair-datahub-stg` | `stg.datahub.lgair-data.com/api/v1` | `lgair-dgdh-stg` |
| `main`    | `lgair-datahub-prd` | `datahub.lgresearch.ai/api/v1` | `lgair-dgdh-prd` |

상세 절차: [`deploy/README.md`](deploy/README.md), 신규 클러스터 부트스트랩: [`deploy/cluster-bootstrap/README.md`](deploy/cluster-bootstrap/README.md).

## 관련 레포

- **웹 포털**: [`data-governance-public/datahub`](https://gitlab.lgresearch.ai/data-governance-public/datahub) — 이 API 를 호출하는 Next.js 프론트엔드
- **파이썬 SDK**: `lgair-datahub` (GitLab PyPI 레지스트리 배포) — CLI/노트북에서 쓰는 thin client
