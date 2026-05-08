# DataHub Architecture Audit v2 — Follow-up Report

**Date**: 2026-04-10
**Scope**: datahub-api + datahub-python
**Baseline**: Architecture Review v1 (2026-04-09)
**Perspective**: 300+ AI Researcher 규모의 중앙화된 오브젝트 스토리지 시스템

---

## Executive Summary

v1 리뷰에서 식별한 **P0 5건, P1 6건, P2 6건** 총 17건의 개선 권장사항 중, **P0 전량 해결, P1 대부분 해결, P2 대부분 반영**되었다. 시스템은 300명 규모 운영을 위한 기본 요건을 충족하는 수준으로 개선되었으나, **GCS lifecycle 삭제 규칙이 잘못 적용되어 데이터 손실 위험이 존재**하며, 멀티 Pod 환경에서의 in-memory 상태 관리 등 신규 리스크가 발견되었다.

### 종합 판정

| 영역 | v1 판정 | v2 판정 | 변화 |
|------|---------|---------|------|
| 300+ 동시 사용 | FAIL | **PASS** | API 3 replica + HPA, DB 풀 확대 |
| 고가용성 | FAIL | **CONDITIONAL PASS** | API/LakeFS/UC 다중화, PostgreSQL은 HA 준비만 |
| 프로덕션 보안 | FAIL | **PASS** | SSL 검증, JWT 검증, 토큰 갱신 구현 |
| 운영 관측성 | FAIL | **CONDITIONAL PASS** | Prometheus 메트릭 + OTel 기반 구축, 알림 규칙 미구성 |

---

## 1. P0 항목 검증 (즉시 조치)

### 1.1 SSL Verification in SDK — RESOLVED

**v1 문제**: `client.py`에서 `verify=False` 하드코딩, 경고 억제

**v2 현재 상태** (`datahub-python/src/datahub/client.py:67`):
```python
verify: bool | str = self._config.auth.ca_bundle or self._config.auth.verify_ssl
self._http = httpx.Client(headers=headers, timeout=120.0, verify=verify)
```

- `verify=False` 제거 확인
- `warnings.filterwarnings("ignore")` 제거 확인
- `config.py`에 `verify_ssl: bool = True` (기본값), `ca_bundle: str = ""` 추가 확인
- 환경변수 `DATAHUB_VERIFY_SSL`, `DATAHUB_CA_BUNDLE` 오버라이드 지원 확인

**판정: PASS**

### 1.2 JWT Secret Startup Validation — RESOLVED

**v1 문제**: `jwt_secret`에 검증 없이 기본값 `"change-me-in-production"` 허용

**v2 현재 상태** (`datahub-api/app/config.py:88-96`):
```python
@field_validator("jwt_secret")
@classmethod
def jwt_secret_must_not_be_placeholder(cls, v: str) -> str:
    if v == _PLACEHOLDER or len(v) < 32:
        raise ValueError(
            "JWT_SECRET must be set to a strong secret (min 32 chars). "
            "Set the JWT_SECRET environment variable."
        )
    return v
```

- `internal_service_secret`과 동일 수준의 검증 적용 확인
- 최소 32자 + placeholder 값 거부 확인
- 테스트 커버리지 존재 (`tests/test_config.py`)

**판정: PASS**

### 1.3 DB Connection Pool Configuration — RESOLVED

**v1 문제**: SQLAlchemy 기본값 `pool_size=5`로 300명 동시 접속 불가

**v2 현재 상태** (`datahub-api/app/database.py:15-22`):
```python
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=settings.database_pool_size,       # default: 20
    max_overflow=settings.database_max_overflow,   # default: 30
    pool_timeout=settings.database_pool_timeout,   # default: 30
    pool_recycle=settings.database_pool_recycle,    # default: 1800
)
```

- 4개 풀 파라미터 환경변수로 설정 가능 확인
- SQLite 환경(테스트)에서는 풀 미적용 분기 처리 확인
- 음수값 검증 validator 추가 (`config.py:98-103`)

**판정: PASS**

### 1.4 API Replica Scaling — RESOLVED

**v1 문제**: 모든 컴포넌트 `replicaCount: 1`

**v2 현재 상태** (`deploy/helm/dp-chart/values.yaml`):

| Component | v1 | v2 | Notes |
|-----------|----|----|-------|
| Platform API | 1 | **3** | + HPA (min 3, max 10, target CPU 70%) |
| LakeFS | 1 | **2** | |
| Unity Catalog | 1 | **2** | |
| PostgreSQL | 1 | 1 | HA는 values-ha.yaml에서 Cloud SQL로 전환 |

리소스 증가:
| Component | v1 Resources | v2 Resources |
|-----------|-------------|-------------|
| Platform API | 1 CPU / 1Gi | **2 CPU / 4Gi** (requests = limits) |

- HPA 설정 확인 (`values.yaml:154-158`)
- values-ha.yaml에서 Cloud SQL 외부 DB 구성 준비 확인

**판정: PASS**

### 1.5 Ingress Rate Limiting — RESOLVED

**v1 문제**: `limit-rps: "10"`, `limit-connections: "20"` → 300명에 과소

**v2 현재 상태** (`values.yaml:149-150`):
```yaml
nginx.ingress.kubernetes.io/limit-rps: "200"
nginx.ingress.kubernetes.io/limit-connections: "400"
```

추가로, **애플리케이션 레벨 per-user rate limiting** 구현 확인 (`app/services/rate_limit.py`):
- Session scope: 60 req/min (auth/session, auth/refresh)
- Transfer scope: 120 req/min (upload/download 세션 생성)
- 사용자 식별: Authorization 헤더 > API Key > IP
- Sliding window 알고리즘, thread-safe (Lock)

**판정: PASS**

---

## 2. P1 항목 검증 (단기 조치)

### 2.1 PostgreSQL HA — PARTIALLY RESOLVED

- `values-ha.yaml`에 Cloud SQL 전환 설정 준비 완료 (PostgreSQL StatefulSet disabled, 외부 DB 참조)
- 현재 프로덕션 `values.yaml`은 여전히 단일 StatefulSet
- **PostgreSQL 백업 CronJob** 추가 (`postgresqlBackup.schedule: "0 3 * * *"`, GCS 버킷 대상)

**판정: CONDITIONAL PASS** — HA 설정은 준비되었으나 프로덕션 적용 여부는 배포 환경에 따라 다름. 백업은 구성 완료.

### 2.2 LakeFS 2+ Replicas — RESOLVED

`values.yaml:216`: `replicaCount: 2` 확인.

**판정: PASS**

### 2.3 Per-User Rate Limiting — RESOLVED

`app/services/rate_limit.py` (68 lines): 위 1.5 참조. 사용자별 sliding window 구현.

**판정: PASS**

### 2.4 Upload Session Cleanup — RESOLVED

`app/services/upload_session_cleanup.py` (82 lines):
- 만료된 세션(pending/uploading 상태 + expires_at 초과) 배치 조회
- 세션 상태 `failed`로 변경 + GCS 고아 오브젝트 삭제
- Helm CronJob: 30분 간격 (`*/30 * * * *`), batch_size 100
- 테스트 커버리지 존재

**판정: PASS**

### 2.5 Prometheus Metrics — RESOLVED

`app/services/metrics.py` (45 lines) + `app/routers/metrics.py` (GET `/metrics`):
- `datahub_process_uptime_seconds` (gauge)
- `datahub_http_requests_total` (counter, method/path/status labels)
- `datahub_http_request_duration_seconds_sum` (counter)
- `datahub_http_request_duration_seconds_max` (gauge)
- Grafana 대시보드 JSON 포함 (`docs/grafana-datahub-api-dashboard.json`)

**판정: PASS**

### 2.6 JWT Refresh Token — RESOLVED

**Server** (`app/config.py:58`): `jwt_refresh_token_ttl_seconds: int = 86400 * 7` (7일)
**Server** (`app/routers/auth.py`): POST `/auth/refresh` 엔드포인트, 토큰 로테이션 구현
**SDK** (`datahub-python/src/datahub/client.py:108-129`):
- 401 응답 시 자동으로 `_refresh_cli_token()` 호출
- refresh_token으로 새 access_token + refresh_token 획득
- CredentialStore에 갱신된 토큰 저장

**추가**: JWT 만료 시간 24시간 → **30분**으로 단축 (`jwt_expiry_minutes: 30`)

**판정: PASS**

---

## 3. P2 항목 검증 (중기 조치)

### 3.1 Organization-Level Permission Inheritance — RESOLVED

**Migration 006** (`alembic/versions/006_org_memberships_and_teams.py`):
- `organization_memberships`: org-user 역할 매핑
- `teams`: org 내 팀 그룹
- `team_memberships`: 팀-사용자 매핑
- `team_repo_permissions`: 팀-repo 권한 매핑

**Authorization** (`app/services/authorization.py:28-69`):
```python
def resolve_role(db, user, repo):
    # 1. 직접 owner 여부
    # 2. 직접 permission 테이블
    # 3. org_membership 상속
    # 4. team_repo_permission 상속
    # → 최고 역할 반환 (max by hierarchy)
```

3계층 권한 상속 체계 구현 확인: Direct > Organization > Team

**판정: PASS**

### 3.2 OpenTelemetry Tracing — RESOLVED (Optional)

`app/services/tracing.py` (36 lines):
- `OTEL_ENABLED=true`로 활성화 (기본 비활성)
- FastAPIInstrumentor로 자동 계측
- OTLP HTTP Exporter 지원
- 의존성 없을 시 graceful skip

**판정: PASS**

### 3.3 Automated PostgreSQL Backup — RESOLVED

`values.yaml:233-241`:
```yaml
postgresqlBackup:
  enabled: true
  schedule: "0 3 * * *"    # 매일 03:00 UTC
  bucket: ""                # GCS 버킷 (환경별 설정)
```

**판정: PASS**

### 3.4 GCS Bucket Lifecycle Policies — INCORRECTLY IMPLEMENTED (REGRESSION)

`app/services/gcs.py:96-97`:
```python
bucket.add_lifecycle_delete_rule(age=settings.gcp_archive_retention_days)  # default: 90
bucket.patch()
```

**위험**: 이 규칙은 버킷 내 **모든 오브젝트**를 90일 후 자동 삭제한다. DataHub는 연구원의 데이터셋 영구 저장소이므로, 정상 데이터가 의도치 않게 삭제될 수 있다. v1에서 권장한 lifecycle 정책의 원래 의도는 업로드 중단으로 남은 고아 오브젝트 정리였으나, 이는 이미 `upload_session_cleanup` CronJob으로 해결되었으므로 버킷 수준 lifecycle 규칙은 불필요하다.

**즉시 조치 필요**:
1. `add_lifecycle_delete_rule(age=90)` 코드 제거
2. 이미 생성된 버킷의 lifecycle 규칙 일괄 제거 (마이그레이션 스크립트)
3. `gcp_archive_retention_days` 설정 항목 제거

**판정: FAIL — 데이터 손실 위험, 즉시 수정 필요**

### 3.5 Grafana Dashboards — RESOLVED

`docs/grafana-datahub-api-dashboard.json` 확인.

**판정: PASS**

### 3.6 Group/Team-Based Access Control — RESOLVED

3.1과 통합 구현. teams + team_memberships + team_repo_permissions.

**판정: PASS**

---

## 4. 추가 개선 사항 (v1 리뷰 외)

v1 리뷰에서 명시적으로 권장하지 않았으나 팀이 자발적으로 추가한 사항:

| 항목 | 내용 |
|------|------|
| Health Check 강화 | `/health/control-plane` 엔드포인트: DB, LakeFS, UC 각각의 연결 상태 + 응답 시간 진단 |
| GCS object_exists() | 다운로드 전 물리 오브젝트 존재 여부 검증 메서드 추가 |
| GCS URI 파싱 강화 | `_split_gcs_uri()` 공통 메서드로 bucket/blob 분리, 유효성 검사 강화 |
| CLI 에러 상세화 | 서버 에러 응답의 path, physical_address 등 구조화된 정보 표시 |
| SDK 자동 세션 갱신 | 401 응답 시 자동 refresh token 사용 → 재로그인 없이 복구 |
| DB 풀 설정 음수 검증 | `positive_database_pool_settings` validator 추가 |
| values-ha.yaml | Cloud SQL + Redis 외부화된 HA 배포 프로필 신설 |
| JWT 만료 단축 | 24시간 → 30분으로 대폭 단축 (refresh token으로 UX 유지) |

---

## 5. 신규 리스크 식별

### 5.1 [MEDIUM] Rate Limiter의 In-Memory 상태

`rate_limit.py`의 sliding window가 프로세스 메모리에 저장됨. API 3 replica 환경에서 각 Pod가 독립적인 rate limit 상태를 유지하므로, **실제 제한은 설정값의 N배** (N = replica 수)가 됨.

```
사용자 → Pod A (60 req/min)
사용자 → Pod B (60 req/min)
사용자 → Pod C (60 req/min)
→ 실질적 제한: 180 req/min
```

**권장**: Redis 기반 분산 rate limiter로 전환. 현재 Redis URL 설정(`redis_url`)은 이미 존재하므로 활용 가능.

**심각도**: MEDIUM — 현재 설정값(60/120)이 보수적이므로 즉시 문제 되지는 않으나, 악의적 사용자가 이를 우회할 수 있음.

### 5.2 [MEDIUM] Metrics의 In-Memory 상태

`metrics.py`도 동일하게 프로세스 메모리에 카운터 유지. 3개 Pod에서 각각 독립적인 메트릭을 수집하므로:
- Prometheus scrape 시 Pod별로 `/metrics` 호출 필요 (Service 레벨 scrape로는 라운드로빈됨)
- Pod 재시작 시 메트릭 초기화

**권장**: Prometheus ServiceMonitor + Pod-level scraping 설정, 또는 `prometheus_client` 라이브러리 사용.

**심각도**: MEDIUM — 메트릭 정확도에 영향. Grafana 대시보드의 수치가 부정확해질 수 있음.

### 5.3 [LOW] Rate Limiter 메모리 누수 가능성

`_WINDOWS` dict에 사용자 키가 무한 누적됨. `clear_rate_limits()` 함수가 존재하나 호출하는 곳이 없음. 장기 운행 시 메모리가 점진적으로 증가.

**권장**: 만료된 윈도우 항목을 주기적으로 정리하는 로직 추가, 또는 Redis 전환 시 TTL로 자동 해결.

### 5.4 [CRITICAL] GCS Lifecycle 규칙으로 인한 데이터 손실 위험

`create_bucket()`에서 모든 신규 버킷에 `add_lifecycle_delete_rule(age=90)`을 적용. 이는 **연구원의 정상 데이터셋을 90일 후 자동 삭제**한다. 고아 오브젝트 정리는 이미 `upload_session_cleanup` CronJob이 담당하므로 이 규칙은 불필요하며 위험하다.

**즉시 조치**:
1. `gcs.py`에서 `add_lifecycle_delete_rule` + `bucket.patch()` 제거
2. 이미 규칙이 적용된 기존 버킷에서 lifecycle 규칙 일괄 제거
3. `config.py`에서 `gcp_archive_retention_days` 설정 제거

### 5.5 [LOW] PostgreSQL 단일 인스턴스 잔존

`values.yaml`의 PostgreSQL은 여전히 단일 StatefulSet(10Gi). values-ha.yaml으로 Cloud SQL HA 전환이 준비되었으나, 기본 프로덕션 설정에는 적용되지 않은 상태.

**권장**: 프로덕션 환경에서 values-ha.yaml 적용 확인 필요.

### 5.6 [INFO] _split_gcs_uri 중복 로직

`gcs.py`에 `_split_gcs_uri()` 정적 메서드가 추가되었으나, `server_side_copy()`는 여전히 인라인으로 URI를 파싱하고 있음 (lines 165-168). 일관성을 위해 리팩토링 권장.

---

## 6. 스펙 충족 현황 (v1 → v2 비교)

| 요구사항 | v1 | v2 | Evidence |
|----------|----|----|----------|
| 오브젝트 스토리지 중앙화 | PASS | **PASS** | 변동 없음 |
| 300명 동시 사용 | FAIL | **PASS** | 3 replica + HPA + DB pool 20/30 |
| 데이터셋 버전 관리 | PASS | **PASS** | 변동 없음 |
| 접근 제어 | PARTIAL | **PASS** | Org + Team 계층적 권한 상속 |
| 데이터셋 검색/발견 | PASS | **PASS** | 변동 없음 |
| CLI/SDK 사용성 | PASS | **PASS** | + 자동 토큰 갱신, 에러 상세화 |
| 대용량 전송 | PASS | **PASS** | 변동 없음 |
| 감사/추적 | PASS | **PASS** | 변동 없음 |
| 고가용성 | FAIL | **CONDITIONAL PASS** | API/LakeFS/UC 다중화, PG HA 준비 |
| 프로덕션 보안 | FAIL | **PASS** | SSL, JWT, refresh token, rate limit |
| 운영 관측성 | FAIL | **CONDITIONAL PASS** | Prometheus + OTel + Grafana, 알림 미구성 |

---

## 7. 신규 권장사항

### P0 (신규 1건)

| # | 항목 | 근거 |
|---|------|------|
| 0 | **GCS lifecycle delete rule 즉시 제거** | 5.4 — 연구원 데이터셋 90일 후 자동 삭제 위험 |

### P1 (신규 + 잔여)

| # | 항목 | 근거 |
|---|------|------|
| 1 | Rate limiter Redis 전환 | 5.1 — 멀티 Pod 환경에서 제한 우회 가능 |
| 2 | Prometheus Pod-level scraping 설정 | 5.2 — 메트릭 정확도 보장 |
| 3 | PostgreSQL HA 프로덕션 적용 | 5.5 — values-ha.yaml 활성화 |
| 4 | 알림 규칙 구성 | Grafana/Prometheus 알림: 에러율 > 5%, p99 > 5s, Pod restart 등 |

### P2 (신규)

| # | 항목 | 근거 |
|---|------|------|
| 5 | Rate limiter 메모리 정리 | 5.3 — 장기 운행 시 메모리 누수 |
| 6 | 기존 버킷의 lifecycle 규칙 일괄 **제거** 확인 | 5.4 |
| 7 | `server_side_copy()` URI 파싱 리팩토링 | 5.6 — 코드 일관성 |

---

## 8. 결론

v1 리뷰에서 식별된 **17건 중 14건이 해결**, 조건부 통과 2건(PostgreSQL HA 프로덕션 적용, 알림 규칙 구성), **1건은 잘못 구현되어 데이터 손실 위험**(GCS lifecycle 규칙)이 있다.

**가장 주목할 변화**:
- JWT 만료 24h → 30min + refresh token: 보안과 UX를 동시에 개선
- 3계층 권한 상속 (Direct → Org → Team): 300명 규모 운영 부담 대폭 감소
- HPA(min 3, max 10) + 리소스 4배 증가: 동시 사용 대응력 확보
- 관측성 기반 마련: Prometheus + OTel + Grafana

**신규 리스크 4건**은 모두 MEDIUM 이하로, 시스템 안정성에 즉각적 위협은 아니나 프로덕션 트래픽 증가 전에 해결을 권장한다. 특히 **rate limiter의 Redis 전환**(P1 #1)은 멀티 Pod 환경의 기본 전제이므로 우선적으로 처리하는 것이 바람직하다.

---

## Appendix: 변경 파일 목록

### datahub-api — 신규 파일

| File | Purpose |
|------|---------|
| `app/services/metrics.py` | Prometheus 메트릭 수집 |
| `app/services/rate_limit.py` | Per-user rate limiting |
| `app/services/tracing.py` | OpenTelemetry 설정 |
| `app/services/upload_session_cleanup.py` | 만료 세션 정리 |
| `app/routers/metrics.py` | GET /metrics 엔드포인트 |
| `alembic/versions/006_org_memberships_and_teams.py` | Org/Team 권한 테이블 |
| `deploy/helm/dp-chart/values-ha.yaml` | HA 배포 프로필 |
| `deploy/helm/dp-chart/templates/upload-session-cleanup-cronjob.yaml` | 세션 정리 CronJob |
| `deploy/helm/dp-chart/templates/postgresql-backup-cronjob.yaml` | DB 백업 CronJob |
| `docs/grafana-datahub-api-dashboard.json` | Grafana 대시보드 |
| `tests/test_config.py` | 설정 검증 테스트 |
| `tests/test_metrics.py` | 메트릭 테스트 |
| `tests/test_rate_limit.py` | Rate limit 테스트 |
| `tests/test_tracing.py` | 트레이싱 테스트 |
| `tests/test_upload_session_cleanup.py` | 세션 정리 테스트 |
| `tests/test_auth_refresh.py` | 토큰 갱신 테스트 |
| `tests/test_authorization_inheritance.py` | 권한 상속 테스트 |
| `tests/test_download_resolution.py` | 다운로드 해상도 테스트 |
| `tests/test_gcs_lifecycle.py` | GCS 라이프사이클 테스트 |

### datahub-api — 수정 파일

| File | Key Change |
|------|-----------|
| `app/config.py` | DB 풀 설정, JWT 검증, rate limit, OTel 설정 추가 |
| `app/database.py` | 커넥션 풀 파라미터 적용 |
| `app/main.py` | Rate limit, metrics, tracing 미들웨어 통합 |
| `app/services/authorization.py` | Org/Team 권한 상속 로직 |
| `app/services/gcs.py` | Lifecycle 규칙, delete_objects, object_exists 추가 |
| `app/routers/auth.py` | Refresh token 엔드포인트 |
| `app/routers/health.py` | Control plane 진단 |
| `deploy/helm/dp-chart/values.yaml` | Replica, HPA, rate limit, 리소스, CronJob 설정 |

### datahub-python — 수정 파일

| File | Key Change |
|------|-----------|
| `src/datahub/client.py` | SSL verify 수정, 자동 토큰 갱신 |
| `src/datahub/config.py` | verify_ssl, ca_bundle 설정 추가 |
| `src/datahub/auth.py` | refresh_token 저장 |
| `src/datahub/cli.py` | 구조화된 에러 상세 표시 |
| `pyproject.toml` | v0.10.12 |
