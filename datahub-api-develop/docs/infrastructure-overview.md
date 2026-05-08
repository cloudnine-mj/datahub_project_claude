# Infrastructure Overview

> 배포 파이프라인 및 데이터베이스 관리 구조 정리 (2026-03-23 기준)
> **업데이트**: 2026-04-02 — GCP 프로젝트 정정 (`lgair-futurecast` → `lgair-dg-data-hub`)

---

## 1. 배포 (CI/CD)

### 파이프라인 개요

GitLab CI 기반으로 `main` 브랜치 푸시 시 자동 배포된다.

```
main 브랜치 커밋
  → 변경 감지 (app/**, mcp_app/**, Dockerfile, pyproject.toml, alembic/**)
  → build:platform  (Docker 이미지 빌드 → GAR 푸시)
  → deploy:platform (GKE rollout restart)
```

### GCP 인프라

| 항목 | 값 |
|------|-----|
| GCP 프로젝트 | `lgair-dg-data-hub` (메인 프로젝트. `lgair-futurecast`는 레거시) |
| 컨테이너 레지스트리 | 확인 필요 (`lgair-futurecast` 기준 문서 작성됨 — 업데이트 필요) |
| GKE 클러스터 | `lgair-datahub-prd` (`us-central1`) |
| K8S 네임스페이스 | `data-platform` |
| K8S Deployment | `dp-platform` |

### Docker 이미지

- 베이스: `python:3.12-slim`
- 시스템 의존성: `gcc`, `libpq-dev`
- 시작 커맨드:
  ```bash
  alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8080
  ```
  - 컨테이너 시작 시 Alembic 마이그레이션 자동 실행 후 FastAPI 서버 기동

### Helm Chart

Helm chart는 별도 디렉토리(`dp-chart/`)로 관리되며, 이 레포에는 포함되어 있지 않다.

```
dp-chart/
├── values.yaml
├── values-dev.yaml
├── values-prod.yaml
├── templates/
└── secrets/sa-key.json
```

설치 절차:
1. `kubectl create namespace data-platform`
2. GCS 서비스 계정 Secret 생성
3. `helm dependency build` → `helm install dp . -f values-dev.yaml`

### K8S 내부 서비스 디스커버리

| 서비스 | 주소 |
|--------|------|
| LakeFS | `lakefs.lgair-data-layer.svc:8000` |
| Unity Catalog | `unity-catalog.lgair-data-layer.svc:8080` |
| PostgreSQL | `dp-postgresql:5432` |

---

## 2. 데이터베이스 관리

### 기술 스택

- **DBMS:** PostgreSQL
- **ORM:** SQLAlchemy 2.0+
- **마이그레이션:** Alembic
- **드라이버:** psycopg2-binary

### 연결 설정

- 설정 파일: `app/config.py` (Pydantic Settings, 환경변수 오버라이드)
- 기본 URL: `postgresql://platform:password@localhost:5432/platform_db`
- 커넥션 풀: `pool_pre_ping=True` (사전 유효성 체크)
- FastAPI `Depends(get_db)` 패턴으로 세션 주입

### 마이그레이션 이력

| 파일 | 내용 |
|------|------|
| `alembic/versions/001_initial_schema.py` | 7개 테이블 초기 생성 |
| `alembic/versions/002_remote_prefix_default.py` | `upload_sessions.remote_prefix` 기본값 설정 |

마이그레이션은 컨테이너 시작 시 `alembic upgrade head`로 자동 실행된다. 별도의 seed 데이터나 fixture는 없다.

### 테이블 구조

#### users
사용자 계정 (Google OAuth 기반)

| 컬럼 | 타입 | 비고 |
|-------|------|------|
| id | Integer (PK) | |
| email | String (unique, indexed) | |
| is_active | Boolean | |
| created_at | DateTime | server_default |

#### api_keys
머신 인증용 API 키

| 컬럼 | 타입 | 비고 |
|-------|------|------|
| id | Integer (PK) | |
| user_id | Integer (FK → users) | |
| key_prefix | String (unique, indexed) | `dl_` 접두사 |
| key_hash | String | bcrypt |
| is_active | Boolean | |
| created_at | DateTime | |
| last_used | DateTime (nullable) | |

#### repos
데이터 레포지토리

| 컬럼 | 타입 | 비고 |
|-------|------|------|
| repo_name | String (PK) | |
| owner_id | Integer (FK → users) | |
| bucket_name | String | |
| created_at | DateTime | |

#### permissions
레포별 접근 제어

| 컬럼 | 타입 | 비고 |
|-------|------|------|
| id | Integer (PK) | |
| repo_name | String (FK → repos) | |
| user_id | Integer (FK → users) | |
| role | String | CHECK: `reader` / `writer` |
| granted_by | Integer (FK → users) | |
| created_at | DateTime | |

- UniqueConstraint: `(repo_name, user_id)`

#### audit_logs
감사 로그

| 컬럼 | 타입 | 비고 |
|-------|------|------|
| id | BigInteger (PK) | 대용량 대응 |
| timestamp | DateTime (indexed) | |
| user_id | Integer (FK, nullable) | |
| user_email | String | |
| action | String (indexed) | |
| resource_type | String | |
| resource_id | String | |
| details | JSONB | |
| ip_address | String | |
| status | String | |
| error_message | String (nullable) | |

#### upload_sessions
멀티파일 업로드 세션

| 컬럼 | 타입 | 비고 |
|-------|------|------|
| id | UUID (PK) | |
| user_id | Integer (FK → users) | |
| repo_name | String (FK → repos) | |
| branch | String | |
| remote_prefix | String | default="" |
| status | String | |
| files_total / files_completed | Integer | |
| commit_message / commit_id | String | |
| metadata_json | JSONB | |
| created_at / updated_at / expires_at | DateTime | |

#### upload_session_files
업로드 세션 내 개별 파일

| 컬럼 | 타입 | 비고 |
|-------|------|------|
| id | Integer (PK) | |
| session_id | UUID (FK → upload_sessions, indexed) | |
| remote_path | String | |
| physical_address / signed_url | String | |
| status | String | |
| size_bytes | BigInteger | |
| checksum | String | |
| created_at | DateTime | |

---

## 3. 인증 방식

현재 3가지 인증 방식을 지원한다:

1. **JWT (서비스 토큰)** - `Authorization: Bearer <token>`, 24시간 만료
2. **Google OAuth Access Token** - Google tokeninfo 검증
3. **API Key** - `X-API-Key: dl_...` 헤더, bcrypt 해시 검증

설정은 `app/config.py`에서 환경변수로 관리:
- `jwt_secret_key` (기본: `change-me-in-production`)
- `google_client_id` / `google_client_secret`
- `oauth_redirect_uri` / `frontend_url`

---

## 4. 주요 외부 의존성

| 서비스 | 용도 | SDK |
|--------|------|-----|
| LakeFS | 데이터 버전 관리 | `lakefs`, `lakefs-sdk` |
| Unity Catalog | 데이터 카탈로그 | HTTP 클라이언트 |
| GCS | 오브젝트 스토리지 | `google-cloud-storage` |
| Claude API | 데이터 메타데이터 enrichment | `anthropic` (claude-haiku-4-5-20251001) |
