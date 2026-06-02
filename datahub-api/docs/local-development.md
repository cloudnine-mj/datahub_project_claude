# Local API Development

이 문서는 `datahub-api`를 실제 FastAPI 서버와 PostgreSQL로 띄워 HTTP 요청까지 검증하는 로컬 개발 루프를 정의합니다.

## 목표

단위 테스트만으로 종료하지 않고 다음 루프를 반복합니다.

1. 임시 로컬 인프라를 띄웁니다.
2. Alembic migration으로 PostgreSQL schema를 구성합니다.
3. FastAPI 서버를 실행합니다.
4. 실제 HTTP smoke check를 수행합니다.
5. 실패하면 로그와 DB 상태를 보고 수정한 뒤 다시 실행합니다.

## Launch-Target 로컬 의존성

| 의존성 | 로컬 기본값 | 비고 |
|--------|-------------|------|
| PostgreSQL | Docker Compose | users, repos, permissions, access_tokens, audit 등 system of record |
| Redis | Docker Compose | rate limit과 세션 저장소. 없으면 일부 경로는 in-memory fallback 가능 |
| FastAPI | 로컬 `uvicorn` 또는 Docker Compose `api` service | 개발 중에는 로컬 `uvicorn --reload`를 권장 |
| Unity Catalog | 기본 구성 제외 | repository-first 계약의 source of truth가 아님 |
| GCS/CAB | 후속 integration profile | 파일 전송 검증 단계에서 별도 구성 |
| MCP | 기본 구성 제외 | future agent integration profile |

## 빠른 시작

```bash
uv venv --python 3.12
source .venv/bin/activate
uv pip install -e ".[dev]"

scripts/dev-api up
scripts/dev-api migrate
scripts/dev-api server
```

다른 터미널에서:

```bash
scripts/dev-api smoke
```

기본 API 주소는 `http://127.0.0.1:18080`입니다.

## Docker 안에서 API까지 실행

로컬 Python 환경 대신 API까지 Docker로 실행하려면:

```bash
scripts/dev-api api-up
scripts/dev-api smoke
```

## 자주 쓰는 명령

```bash
scripts/dev-api check-ports
scripts/dev-api ps
scripts/dev-api logs
scripts/dev-api logs api
scripts/dev-api env
scripts/dev-api reset
scripts/dev-api down
```

`reset`은 PostgreSQL volume을 삭제하고 migration을 다시 적용합니다.

## 포트 충돌 대응

기본 포트는 다음과 같습니다.

| 서비스 | 기본 포트 | 변경 변수 |
|--------|-----------|-----------|
| API | `18080` | `DATAHUB_DEV_API_PORT` |
| PostgreSQL | `15432` | `DATAHUB_DEV_POSTGRES_PORT` |
| Redis | `16379` | `DATAHUB_DEV_REDIS_PORT` |

이미 같은 포트를 쓰는 프로세스가 있으면 포트를 직접 코드나 Compose 파일에 하드코딩하지 말고 환경 변수로 변경합니다.

```bash
DATAHUB_DEV_API_PORT=18081 scripts/dev-api server
DATAHUB_DEV_POSTGRES_PORT=15433 DATAHUB_DEV_REDIS_PORT=16380 scripts/dev-api up
DATAHUB_DEV_API_PORT=18081 scripts/dev-api smoke
```

같은 머신에서 여러 작업자가 동시에 Compose 환경을 띄워야 하면 project name도 분리합니다.

```bash
DATAHUB_DEV_COMPOSE_PROJECT=datahub-api-dev-karlo \
DATAHUB_DEV_API_PORT=18081 \
DATAHUB_DEV_POSTGRES_PORT=15433 \
DATAHUB_DEV_REDIS_PORT=16380 \
scripts/dev-api api-up
```

현재 설정된 포트 상태는 다음 명령으로 확인합니다.

```bash
scripts/dev-api check-ports
scripts/dev-api env
```

## 현재 smoke check 범위

`scripts/dev_api_smoke.py`는 다음을 검증합니다.

| 요청 | 검증 내용 |
|------|-----------|
| `GET /api/v1/health` | 서버 기동 |
| `GET /api/v1/meta/licenses` | 비인증 read endpoint |
| `GET /api/v1/auth/whoami` | service JWT 인증과 user upsert |
| `POST /api/v1/auth/session` | DB 기반 session 응답과 audit write |
| `POST /api/v1/auth/access-tokens` | access token 발급 |
| `GET /api/v1/auth/access-tokens` | 발급된 Bearer access token 인증 |

이 smoke check는 GCS integration 없이도 launch-target 인증과 DB write/read 경로를 검증하도록 의도적으로 제한합니다.

Runtime 의존성 분류는 [API Runtime Dependency Matrix](./runtime-dependency-matrix.md)를 기준으로 합니다.

## 환경 변수

`scripts/dev-api`는 로컬 기본값을 제공합니다.

| 변수 | 기본값 |
|------|--------|
| `DATABASE_URL` | `postgresql://platform:password@localhost:15432/platform_db` |
| `REDIS_URL` | `redis://localhost:16379/0` |
| `JWT_SECRET` | local dev 전용 32자 이상 secret |
| `INTERNAL_SERVICE_SECRET` | local dev 전용 32자 이상 secret |
| `MCP_ENABLED` | `false` |
| `DATAHUB_DEV_API_PORT` | `18080` |
| `DATAHUB_DEV_POSTGRES_PORT` | `15432` |
| `DATAHUB_DEV_REDIS_PORT` | `16379` |

운영 secret이나 개인 credential을 이 저장소에 커밋하지 않습니다.

## MR 작성 규칙

API 동작 변경 MR은 다음을 설명에 남깁니다.

| 항목 | 내용 |
|------|------|
| 실행 환경 | local `uvicorn` 서버인지, Compose `api` service인지 |
| 사용 포트 | API/PostgreSQL/Redis 포트 |
| smoke 결과 | `scripts/dev-api smoke` 수행 여부와 결과 |
| 추가 검증 | pytest/ruff/수동 HTTP 요청 등 |
| 미수행 사유 | 외부 GCS/CAB 등 기본 profile 밖 의존성이 필요한 경우 |

GitLab MR 템플릿은 `.gitlab/merge_request_templates/default.md`를 사용합니다.
