# API Runtime Dependency Matrix

이 문서는 `datahub-api`의 launch-target runtime 의존성을 정리합니다.

## 기준

| 구분 | 의미 |
|------|------|
| Core | API 서버 기동과 launch-target 인증/권한/메타데이터 요청에 필요 |
| Integration | 특정 기능 검증에 필요하지만 기본 로컬 루프에는 포함하지 않음 |
| Optional | 설정하면 사용하고, 없으면 fallback 또는 비활성화 가능 |

## Launch-Target Core

| 의존성 | 사용 영역 | 로컬 기본값 |
|--------|-----------|-------------|
| PostgreSQL | users, repos, permissions, access_tokens, audit, visibility policy | `postgres:16-alpine` |
| Alembic | schema migration | `scripts/dev-api migrate` |
| JWT secret | service JWT/session 인증 | dev 전용 기본값 |
| Internal service secret | `X-Service-Token` 검증 | dev 전용 기본값 |
| FastAPI/Uvicorn | API process | local `uvicorn` 또는 Compose `api` |

## Optional

| 의존성 | 사용 영역 | 기본 처리 |
|--------|-----------|-----------|
| Redis | rate limit, session store | 로컬 Compose 제공. 미설정 시 일부 경로는 in-memory fallback |
| OpenTelemetry | tracing export | `OTEL_ENABLED=false` |
| LLM API | metadata enrichment | `LLM_API_KEY` 없으면 skip |
| Google OAuth | browser login | service JWT/access token smoke에서는 사용하지 않음 |
| Unity Catalog | future catalog integration | 기본 배포 비활성화 |
| MCP | future agent integration | `MCP_ENABLED=false` |

## Integration Profile

| 의존성 | 사용 영역 | 비고 |
|--------|-----------|------|
| GCS | file byte storage, bucket/object operation | 파일 전송 integration profile에서 별도 구성 |
| Google ADC / CAB | CLI/SDK direct transfer credential | local smoke 기본 범위 밖 |

## Develop K8s Runtime

| 의존성 | develop 배포 처리 | 비고 |
|--------|-------------------|------|
| FastAPI platform | `dh-platform` Deployment | image tag는 CI commit SHA로 주입 |
| PostgreSQL | `lgair-datahub-db` 네임스페이스의 공유 `platform_db` | `DATABASE_URL`은 CI에서 구성 |
| Redis | in-cluster Redis | dev/stg values에서 활성화 |
| Unity Catalog | disabled | repository-first source of truth 아님 |
| MCP | disabled | ConfigMap에서 `MCP_ENABLED=false` |

## 정리된 부분

| 항목 | 처리 |
|------|------|
| 로컬 Compose | PostgreSQL, Redis, API service |
| 로컬 스크립트 | `up`, `migrate`, `server`, `api-up`, `smoke`, `reset` |
| File transfer | GCS/CAB control-plane endpoint 기준 |
| Versioning PoC surface | runtime router/service/dependency에서 제거 |
| Auth | Bearer Access Token만 인증 경로로 사용 |
| Smoke check | DB 기반 auth/session/access-token HTTP 요청 검증 |
| Port override | `DATAHUB_DEV_*_PORT`, `DATAHUB_DEV_COMPOSE_PROJECT`로 병렬 로컬 환경 지원 |
