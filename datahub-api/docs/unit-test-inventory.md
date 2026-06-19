# DataHub API 단위 테스트 현황 진단 (Test Inventory & Coverage)

> 목적: "어떤 단위 테스트가 어떻게 수행되고 있는가"를 사실 기반으로 파악하여
> 불확실성을 줄이고, 경계검사 강화 대상을 식별하기 위한 진단 문서.
>
> 측정 기준: `uv sync --frozen --extra dev`(lockfile 고정 의존성, fastapi 0.135.1)
> + `pytest-cov`. 측정 결과: **432 passed / 19 skipped / 0 failed**, 라인 커버리지 **75.3%**.

---

## 0. 한눈에 보기 (Executive Summary)

| 항목 | 현황 |
|---|---|
| 테스트 규모 | 55개 파일 · 67 클래스 · **399 테스트 함수** |
| 직전 실행 결과 | **432 pass · 19 skip · 0 fail** (skip = e2e, 실서버 필요) |
| 라인 커버리지 | **75.3%** (4,637 stmt 중 1,147 미커버) |
| 실행 기반 | **SQLite in-memory** (실DB/실GCS 연결 없음) |
| **CI 자동 강제** | ⚠️ **pytest/ruff는 CI 게이트가 아님.** CI는 `validate:scope-matrix` 1개만 강제 |
| 단위 테스트 실행 시점 | 개발자 로컬 + **MR 템플릿 체크박스 자가신고**(self-attest) |

**핵심 메시지 1 — "매 MR에서 테스트가 수행/성공"은 자동 게이트가 아니라 사람의 성실성에 의존한다.**
`.gitlab-ci.yml`에는 pytest 잡이 없다. 통과 여부는 개발자가 MR에 직접 체크하는 방식이며, 빠뜨려도 머지가 막히지 않는다. 이것이 현재 불확실성의 1차 원인이다.

**핵심 메시지 2 — 단위 테스트는 PostgreSQL이 아니라 SQLite로 돈다.**
실서비스의 JSONB 컬럼을 쓰는 경로는 테스트에서 의도적으로 제외된다(아래 §5). 방언(dialect) 차이로 인한 사각지대가 구조적으로 존재한다.

---

## 1. 테스트가 "어떻게" 수행되는가 (실행 메커니즘)

### 1.1 실행 명령
README / AGENTS.md / MR 템플릿 기준 표준 명령:
```bash
uv run --frozen --extra dev python -m pytest -q     # 단위 테스트
uv run --frozen --extra dev ruff check app tests    # 린트
scripts/dev-api smoke                                # 실서버 HTTP 스모크 (별도)
```

### 1.2 테스트 환경 부트스트랩
- `tests/conftest.py`는 **환경변수만 주입**한다(공용 DB/Client fixture 없음):
  - `DATABASE_URL=sqlite:///:memory:`
  - `JWT_SECRET`, `INTERNAL_SERVICE_SECRET`, `GCP_PROJECT` 테스트용 더미값.
- 공용 픽스처가 없으므로 **각 테스트 파일이 자기 환경을 직접 구성**한다. 전형적 패턴(`test_organizations.py` 등):
  1. 검증 대상 **라우터 1개만** 붙인 최소 `FastAPI` 앱 생성
  2. `app.dependency_overrides`로 `get_db`(SQLite 세션) / `get_current_user`(가짜 사용자) 오버라이드
  3. `create_engine("sqlite:///:memory:", StaticPool)` + `Base.metadata.create_all(...)`
  4. `TestClient` 또는 직접 함수 호출로 검증

### 1.3 테스트 스타일 분포 (399 테스트)
| 스타일 | 설명 | 대략 비중 |
|---|---|---|
| `TestClient` (인프로세스 통합) | 실제 라우팅·의존성 그래프를 태움 | 15개 파일 |
| `MagicMock` / `monkeypatch` (단위) | 외부 의존(GCS·OAuth·Redis)을 목으로 대체 | 37개 파일 |
| `sqlite-orm` | 실제 ORM 쿼리를 SQLite로 검증 | 11개 파일 |
| 순수 함수 단위 | DB/HTTP 없이 로직만 | naming·config·visibility 등 |

### 1.4 CI 통합 현실 (`.gitlab-ci.yml`)
```
stages: [validate, build, deploy]
```
- `validate` 단계의 유일한 잡 = **`validate:scope-matrix`**
  → `dump_scope_matrix --check architecture/scope-matrix.md` (권한 스코프 정의 drift 검사). 현재 ✅ in sync (42 entries).
- **pytest·ruff 잡은 존재하지 않는다.** MR 템플릿(`.gitlab/merge_request_templates/default.md`)에 체크박스로만 존재:
  ```
  - Additional tests:
    - [ ] uv run --frozen --extra dev python -m pytest ...
    - [ ] uv run --frozen --extra dev ruff check ...
  ```
- pre-commit 훅 / git 훅 설정 없음.

---

## 2. 테스트 인벤토리 — 도메인별 분류

| 도메인 | 테스트 파일 (테스트 수) | 검증 깊이 |
|---|---|---|
| **인증·SSO·세션·토큰** | service_auth(16), scopes(17), access_tokens(26), access_tokens_scenarios(8), azure_sso(12), azure_sso_login(10), azure_linking(7), auth_refresh(1), issue84_auth(16), me_endpoint_groups(4) | 정상+실패 경로 비교적 두꺼움. 스코프 매트릭스 검증 강함 |
| **저장소 메타데이터** | repo_schema_ext(16), repo_visibility(13), visibility_patch(7), repo_metadata_search(6), get_single_repo(9), repo_members_contract(4), rename_api(7), repo_manifest(7), resolve_endpoint(7), issue26_group_repo_crud(15), repo_owner_repo_path(4), delete_repo_owner_repo_path(4), repo_list_pagination(2) | 광범위. CRUD·가시성·이름변경 중심 |
| **식별자·네이밍 (경계검사 핵심)** | repo_naming(28), repo_identity_uuid7(5), issue67_bucket_naming(6), legacy_bucket_migration(9), file_path_normalization(3) | 입력 경계 검증이 가장 충실한 영역 |
| **파일 전송·GCS** | files_signed_url(11), files_service_caller_branching(11), file_transfer_integrity(7), upload_stream(5), gcs_copy(1), gcs_lifecycle(1), gcs_metadata(2), remove_bucket_lifecycle_rules(3), **files_live(19, e2e)** | 단위는 목 중심. 실 GCS 경로는 e2e로 분리(평시 skip) |
| **권한·인가** | check_access_composite(4), authorization_inheritance(3), discovery_hardening(2), group_member_reject_unknown_user(2), permissions(라우터, 표에 포함) | 합성 권한·상속 검증 존재하나 얇음 |
| **그룹·조직** | groups_canonical(8), organizations(15), organizations_deprecation_headers(4), issue24_group_scoped_aliases(4) | 라우터 organizations 커버리지 낮음(§4) |
| **리니지** | lineage_compat(3) | 호환성 위주, 얇음 |
| **관측·인프라·계약** | metrics(2), tracing(1), rate_limit(4), idempotency(3), config(6), error_envelope(2), openapi_path_routing(2), scope_matrix_dump(4), alembic_versions(1) | 기반 계약 검증 |

> 관찰: **이슈 번호 기반 회귀 테스트**(`test_issue24/26/67/84`)가 다수 → 버그 재발 방지 문화는 있음. 단, 신규 기능의 사전 경계검사보다 **사후 회귀**에 가까운 패턴.

---

## 3. 커버리지 정량 결과 (pytest-cov, `--cov=app`)

### 3.1 영역별 요약
| 영역 | 커버리지 |
|---|---|
| schemas (Pydantic 모델) | **97%** |
| core (main·models·db·deps·error) | 84% |
| routers | **69%** |
| services | **69%** |
| **전체** | **75.3%** |

### 3.2 커버리지 하위 모듈 (강화 우선 후보)
| 커버리지 | 모듈 | 미커버 | 비고 |
|---|---|---|---|
| **0%** | `schemas/common.py` | 11 | 공용 스키마, 테스트 전무 |
| **26%** | `services/cab.py` | 40 | CAB downscoped token — 파일전송 보안 핵심인데 거의 미검증 |
| **26%** | `services/enrichment.py` | 31 | 메타데이터 enrichment |
| **31%** | `services/tracing.py` | 18 | OTLP 트레이싱 |
| **31%** | `routers/organizations.py` | 179 | 라우터 중 최저. 조직 권한 분기 대량 미커버 |
| **45%** | `services/google_oauth.py` | 17 | Google SSO 토큰 교환 경로 |
| **46%** | `routers/lineage.py` | 51 | 리니지 라우터 |
| **51%** | `services/gcs.py` | 77 | GCS 클라이언트 — 목으로만, 실경로 미검증 |
| **57%** | `services/azure_oauth.py` | 35 | Azure SSO |
| **59%** | `routers/health.py` | 14 | 헬스/의존성 점검 |
| **64%** | `routers/meta.py` | 42 | 메타 vocabulary |
| **69%** | `app/dependencies.py` | 43 | `require_scope` 등 인가 의존성 일부 분기 |

> 전체 75%는 양호한 편이나, **보안·외부연동(CAB·GCS·OAuth)과 조직 권한 라우터**에 커버리지가 쏠려 비어 있다. 즉 "가장 깨지면 위험한 곳"이 "가장 덜 검증된 곳"과 겹친다.

---

## 4. 구조적 사각지대 (불확실성의 근원)

1. **SQLite ↔ PostgreSQL 방언 갭 (가장 중요).**
   단위 테스트는 SQLite in-memory로 돌고, **JSONB를 쓰는 테이블은 테스트에서 의도적으로 제외**된다(`test_organizations.py`의 `_SQLITE_TABLES` 주석: *"JSONB 포함 테이블 제외"*). 실서비스는 PostgreSQL + JSONB(`app/models.py`, `app/services/audit.py`). → JSONB 직렬화/쿼리, Postgres 전용 제약·인덱스, 트랜잭션 격리 동작은 단위 테스트로 **검증되지 않는다.** 이 경로는 `scripts/dev-api smoke`(실 Postgres) 또는 e2e에만 의존.

2. **CI 미강제.**
   pytest가 CI 게이트가 아니므로, 회귀를 자동으로 잡는 그물은 `scope-matrix` 한 칸뿐. "통과"는 개발자 자가신고. → 누락 시 무방비.

3. **커버리지 가시성 부재.**
   `pytest-cov`가 의존성에 없어, 본 문서 측정 전까지 **정량 커버리지를 아는 사람이 없었다.** 회귀로 커버리지가 떨어져도 감지 수단이 없음.

4. **외부 연동의 목(mock) 의존.**
   GCS·CAB·OAuth·Redis가 전부 목. 계약(요청/응답 형태) 변화는 단위 테스트가 못 잡고 e2e/스모크에만 의존하는데, e2e는 평시 skip된다(19개).

---

## 5. 경계검사 강화 후보 (boundary-test backlog)

> "이미 잘 된 곳"과 "비어 있는 곳"을 구분해 제안.

**이미 충실한 경계검사 (유지):**
- 식별자/네이밍: `repo_naming`(28), `repo_identity_uuid7`, `bucket_naming`, `file_path_normalization` — 입력 경계가 가장 두꺼움.
- 스코프/권한 매트릭스: `scopes`(17), `access_tokens*`, `scope_matrix_dump`.

**우선 강화 권장 (커버리지 + 위험도 교차):**
| 우선순위 | 대상 | 강화 방향 |
|---|---|---|
| 高 | `services/cab.py` (26%) | downscoped token 발급 경계: 권한 축소 범위, 만료, 잘못된 scope 거부 |
| 高 | `routers/organizations.py` (31%) | 조직 권한 분기(멤버/비멤버/관리자) 경계 + 입력 검증 |
| 高 | JSONB 경로 | Postgres 기반 테스트(testcontainers 등)로 JSONB 직렬화·쿼리 경계 검증 |
| 中 | `services/gcs.py` (51%) | 실패 응답(권한거부·미존재·타임아웃) 분기 경계 |
| 中 | `services/*_oauth.py` (45~57%) | 토큰 교환 실패·만료·서명검증 실패 경계 |
| 中 | `routers/lineage.py` (46%) | 리니지 입력 검증·순환참조 등 경계 |

---

## 6. 권고 (다음 단계)

1. **가시화 정착**: `pytest-cov`를 `[dev]` 의존성에 추가하고 커버리지를 리포트로 남긴다(임계선은 합의 후 설정 — 예: 신규 코드 회귀 방지부터).
2. **게이트 승격 건의**: pytest/ruff를 MR 체크박스에서 **CI `validate` 단계 잡으로 승격**. 경계검사를 아무리 강화해도 자동 강제가 없으면 효과가 반감된다. (이미 `validate:scope-matrix`가 `uv sync` 패턴을 쓰므로 동일 패턴으로 추가 용이.)
3. **방언 갭 메우기**: 핵심 JSONB/Postgres 경로에 한해 Postgres 기반 테스트(testcontainers 또는 dev Postgres) 도입 검토.
4. **경계검사 강화**: §5 표의 高 우선순위부터 착수.

> 1·3·4는 코드/설정 변경(별도 MR), 2는 팀 합의가 필요한 정책 변경이다.
</content>
</invoke>
