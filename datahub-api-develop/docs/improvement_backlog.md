# datahub-api 개선 백로그 (Improvement Backlog)

> **작성일**: 2026-04-22 · **기준 브랜치**: `develop` · **작성 방법**: 3명의 리뷰어가 라우터를 분담해 감사 후 취합
>
> **범위**: `app/routers/*` 전수 + `app/dependencies.py` + 관련 서비스 일부 (`lakefs`, `unity_catalog`, `gcs`, `cab`)
>
> **용도**: 우선순위별 PR 묶음 단위로 분해해 점진적 개선. 해결된 항목은 체크(`[x]`) 처리 후 해당 MR 링크 첨부.

---

## 0. 요약

| 우선순위 | 개수 | 의미 |
|---------|:---:|------|
| 🔴 **High** | ~48 | 데이터 일관성·보안·성능에 직접 영향. 가까운 시일 내 해결 필요 |
| 🟡 **Medium** | ~36 | UX·코드 품질·관측성 이슈. 정비 PR 단위로 묶어 처리 |
| 🟢 **Nice-to-have** | ~15 | 품질 개선 제안. 여유 있을 때 |
| **합계** | ~99 | |

**톱 10 (바로 착수 가능 순)** 은 [§ 4](#4-top-10-바로-착수) 참조.
**PR 묶음 제안** 은 [§ 5](#5-pr-묶음-제안)\_(A ~ E).

---

## 1. 공통 패턴 — 횡단 이슈 5가지

라우터를 넘어 반복되는 구조적 결함. 단일 라우터 수정이 아닌 **계층 레벨 대책** 필요.

### ① 3-way 오케스트레이션의 부분 실패 (최고 심각도)

`GCS + LakeFS + UnityCatalog` 3개 외부 시스템을 순차 호출하는 엔드포인트에서, 2·3번째 단계가 실패하면 1번째 단계가 그대로 남아 **상태 불일치**가 발생함.

| 위치 | 시나리오 |
|------|---------|
| `repos.create_repo` | 프로비저닝 성공 → DATACARD 초기 커밋 실패 → 반만 만들어진 repo |
| `repos.delete_repo` | UC/LakeFS/GCS 삭제 실패 후에도 DB row 먼저 지워짐 → 외부 orphan |
| `files.upload_complete` | 병렬 link 중 일부 실패 → session 일부만 `failed`, 나머지 성공으로 남음 |
| `files.upload_stream_commit` / `versioning.merge` | UC sync 실패를 `logger.warning` 으로만 기록 (silent) |
| `files.migrate` | GCS 복사 성공 → 리니지 등록 실패 시 추적 불가 |

**해결 방향**
- **Saga / 보상 트랜잭션 패턴**: 각 단계의 역작업(compensate) 등록
- **실패 기록 테이블** (`pending_reconciliation`) + 백그라운드 reconciler
- **최소 대응**: 외부 삭제 먼저, DB 삭제 나중 (repos.delete) / 실패 플래그를 응답에 포함

### ② 검색·리스트의 N+1 / 전수 스캔

| 위치 | 문제 |
|------|------|
| `catalog.search` | 모든 `catalog × schema × table` 순회 → 100K 테이블에서 응답 불가 수준 |
| `catalog._get_accessible_repo_names` | 매 호출 3쿼리 (owner + permission + public) |
| `lineage.graph` | 모든 노드에 대해 `Repo.query()` 개별 실행 |
| `organizations.list_teams_members` | `TeamMembership` 순회 후 `m.user.email` lazy load |
| `dashboard.stats` | 매번 `count()` 3회 full-scan |

**해결 방향**
- UNION / JOIN 쿼리로 통합, `selectinload`/`joinedload`
- Redis 5~30분 TTL 캐시 (통계·필터 옵션)
- UC 레벨 검색 인덱스 (Elasticsearch 연동 또는 UC 쿼리 API)

### ③ 입력 검증 부재

| 항목 | 영향 |
|------|------|
| `email` 미검증 (`permissions.grant`, `organizations.add_member` 등) | 오타 입력 시 유령 user 자동 생성 |
| `Role` whitelist 미검증 (`organizations`) | DB 에 임의 문자열 저장 |
| `LIKE` 쿼리의 `%`/`_` 미이스케이프 (`users.py:50`, `organizations.py:213`) | 검색 와일드카드 우회 |

**해결 방향**
- Pydantic `EmailStr`, `Literal[...]` 타입 전면 도입
- `sqlalchemy.sql.expression.escape_like` 유틸 공통화
- `get_or_create_user` → **명시 존재 확인** 후 실패 응답 (회원 가입은 OAuth 흐름만)

### ④ 에러 메시지가 민감정보 노출

| 위치 | 현상 |
|------|------|
| `health.control_plane` | `psycopg2.OperationalError: <connection string>` 그대로 응답 |
| `catalog.get_table` | UC 다운/404/500 구별 없이 `except Exception` 으로 404 반환 |
| OAuth 콜백 예외 | 모든 예외 → 500 일괄, 재시도/재로그인 가이드 없음 |

**해결 방향**
- 내부 에러 = 로그에만, 응답은 generic 메시지
- 예외 타입별 상태 코드 매핑 (401 vs 502 vs 504)
- 에러 응답 스키마 표준화 (`{code, message, request_id}`)

### ⑤ JWT / API Key 처리의 미묘한 버그

| 위치 | 문제 |
|------|------|
| `dependencies._authenticate_api_key` | `raw_key[:11]` prefix 계산 — 실제 키 길이와 가정 어긋남 |
| `dependencies._try_verify_jwt` | JWT 만료 vs 위변조 구별 없음 → refresh vs 재로그인 구분 불가 |
| `auth.DEVICE_FLOW_TTL` | 600초 하드코딩 → settings 로 빼야 함 |

**해결 방향**
- API key 고정 길이 보장 또는 prefix 상수 교정
- `_try_verify_jwt` 가 `("expired", None)`, `("invalid", None)`, `("ok", email)` 구분
- TTL 류 전부 `app/config.py` 이관

---

## 2. 라우터별 상세

### 2.1 `routers/auth.py`

#### 🔴 High Priority
- [ ] **[callback·device 분기]** `state[len("device:"):]` 문자열 slice 경계값 미검증 — malformed state 시 빈 device_code 로 진행 가능. **→ 길이/형식 사전 검증**
- [ ] **[DEVICE_FLOW_TTL 하드코딩]** 600초 상수 — 운영 중 조정 불가. **→ `settings.device_flow_ttl_seconds`**
- [ ] **[CLI redirect URL injection]** `cli_port` 는 1024-65535 만 검증, localhost 강제 없음. **→ 현재는 localhost 하드코딩돼 있어 OK 지만 상수화 필요**
- [ ] **[refresh_token race]** 기존 토큰 삭제 ↔ 신규 발급 사이 concurrent refresh 시 토큰 중복 발급 가능. **→ Redis WATCH/MULTI 또는 Lua script 로 atomic 교체**
- [ ] **[API key prefix]** `raw_key[:11]` 은 `"dl_" (3) + token_urlsafe(32)` 기준에서 11자 미만일 수 있음. **→ prefix 길이를 키 생성 함수에 귀속**
- [ ] **[응답 스키마 누락]** `DELETE /auth/api-keys/{prefix}`, `POST /auth/logout` 등이 `response_model` 미지정. **→ Pydantic 스키마 일괄 지정**
- [ ] **[OAuth 예외 분화 부재]** `exchange_authorization_code`, `get_user_info` 예외 모두 500. **→ 네트워크 timeout / token invalid / user_info 거부 분리**
- [ ] **[audit 누락]** `device_init`, `device_token` 성공/실패에 audit 기록 없음. **→ `action="device_init" / "device_token"` 기록**

#### 🟡 Medium Priority
- [ ] **[email 미검증]** Google 에서 받은 email 을 `get_or_create_user` 에 그대로 전달. **→ regex 또는 EmailStr 검증**
- [ ] **[TTL 단위 혼용]** `jwt_expiry_minutes`(분) vs `DEVICE_FLOW_TTL`(초) 혼재. **→ 모두 초로 통일**
- [ ] **[paste 페이지 UX]** "30분 내 사용" 문구가 TTL 값과 불일치 가능 (TTL=600s=10분). **→ 동적 반영**
- [ ] **[로그인 우선순위 주석만]** `paste > port > web` 순서가 주석만 있고 테스트 없음. **→ unit test 추가**
- [ ] **[JWT secret 노출]** JWT HS256 대칭키. 키 유출 시 전수 위조 가능. **→ RS256 + 키 로테이션 정책**

#### 🟢 Nice-to-have
- [ ] **[CSP 헤더]** inline style/script 사용 — CSP 엄격화 어려움. **→ 외부 CSS 파일화**
- [ ] **[API key 응답 안내]** "This key will not be shown again" 문구 포함
- [ ] **[Device flow 에러 페이지 다국어]** 현재 한국어만

### 2.2 `dependencies.py`

#### 🔴 High Priority
- [ ] **[API key prefix 계산]** 위 §2.1 과 동일 이슈 반대편
- [ ] **[JWT 만료 vs 위조 구별]** `_try_verify_jwt` 가 양쪽 모두 `None` → 401 이 refresh 필요인지 재로그인 필요인지 클라 판단 불가. **→ 예외 타입 보존**
- [ ] **[Google token 검증 실패 silent]** `verify_google_token` 실패 시 빈 이메일로 `get_or_create_user(db, None)` 호출 가능. **→ try-except + 명시적 401**

#### 🟡 Medium Priority
- [ ] **[Bearer 파싱 헐거움]** `parts[0].lower() == "bearer"` + 공백 split 만 사용. **→ regex 검증**
- [ ] **[rate limit 미통합]** API key 인증은 `last_used` 만 업데이트. **→ `rate_limit` 서비스와 연동**
- [ ] **[에러 메시지 모호]** 401 detail 이 길고 장황. **→ 간결화**

#### 🟢 Nice-to-have
- [ ] **[get_or_create_user 커밋 단위]** 매 호출 DB commit — 배치 처리 시 오버헤드

### 2.3 `routers/users.py`

#### 🔴 High Priority
- [ ] **[Username 충돌]** email local-part(`john@a.com`, `john@b.com` 둘 다 `john`) 으로 파생 — 다른 도메인 동명 사용자 충돌. **→ 합성 unique `(local, domain)` 또는 명시 username 필드**
- [ ] **[LIKE injection]** `f"{username}@%"` 에 `%`, `_` 미이스케이프. **→ `sqlalchemy.sql.expression.literal().ilike(...)` + escape**

#### 🟡 Medium Priority
- [ ] **[response_model 불일치]** `avatar_url` 이 항상 None 이지만 스키마에 있음. **→ 구현 or 스키마 맞추기**
- [ ] **[N+1]** `Repo.owner_id == user.id` 로드 시 owner join 없음. **→ joinedload**
- [ ] **[공개 프로필 인증 없음]** 의도적 — Cache-Control 헤더만 추가

#### 🟢 Nice-to-have
- [ ] **[프로필 가시성 문서화]** "public repo 만 노출" 의도 주석 추가

### 2.4 `routers/permissions.py`

#### 🔴 High Priority
- [ ] **[권한 변경 race]** existing 조회 → update/insert 사이 동시 요청 중복 가능. **→ unique constraint + `ON CONFLICT DO UPDATE`**
- [ ] **[owner 권한 분리 관리]** owner 는 `repos.owner_id`, 나머지는 `permissions` 테이블 — 조회 로직 분기. **→ 통합 뷰 or Permission 테이블에 owner 도 저장**
- [ ] **[email 미검증]** body.email 그대로 DB. **→ EmailStr**
- [ ] **[타겟 유저 자동 생성]** 오타 email 로 유령 user 생성. **→ 존재 확인, 미등록이면 400 반환**

#### 🟡 Medium Priority
- [ ] **[response_model 누락]** 삭제/부여 응답 `{"status": ...}` dict. **→ 스키마 정의**
- [ ] **[`can_assign_role` 중복]** 2군데 동일 로직. **→ 헬퍼 추출**
- [ ] **[audit 상세도]** 변경 전/후 값 미기록

### 2.5 `routers/organizations.py`

#### 🔴 High Priority
- [ ] **[멤버 자동 생성]** `add_member`, `add_team_member` 에서 미존재 email 자동 user 생성. **→ 초대 워크플로우 또는 거부**
- [ ] **[조직 삭제 시 repo 고아]** `org_id` NULL 설정만 — 정책 불명확. **→ orphan 처리 전략 (삭제 / 유지 / 승계) 중 택1 + 문서화**
- [ ] **[팀 멤버 중복 추가]** existing None 일 때만 insert — idempotent 처럼 보이지만 부분 실패 시 일관성 문제. **→ upsert**
- [ ] **[role whitelist 미검증]** body.role 임의 문자열 저장 가능. **→ `Literal["owner","maintainer","developer","guest"]`**
- [ ] **[role 상수 하드코딩]** "owner" 등 문자열이 scattered. **→ 상수 모듈**

#### 🟡 Medium Priority
- [ ] **[팀 멤버 N+1]** `TeamMembership → user.email` lazy. **→ joinedload**
- [ ] **[response_model 불일치]** `granted_by` 포함/미포함 혼재
- [ ] **[pagination 없음]** `list_teams`, `list_members` 대규모 조직에서 전체 로드
- [ ] **[LIKE injection]** `org_name.ilike(f"%{search}%")` escape 없음
- [ ] **[audit 조건부 누락]** 중복 추가 시 audit 스킵

#### 🟢 Nice-to-have
- [ ] **[OrgStatsResponse 캐싱]**
- [ ] **[멤버십 모델 혼동]** Organization vs Team membership 분리 이유 문서화

### 2.6 `routers/repos.py`

#### 🔴 High Priority
- [ ] **[create_repo orchestration]** 프로비저닝 성공 후 DATACARD 커밋 실패 시 rollback 없음. **→ 보상 트랜잭션 or deprovision 호출**
- [ ] **[delete_repo 순서]** 외부 리소스 삭제 실패 후 DB row 삭제 → orphan. **→ 외부 → DB 순**
- [ ] **[get_repo_stats 성능]** LakeFS `list_objects(recursive=True)` + UC 조회 — 대형 repo 타임아웃 가능. **→ 캐시 + 비동기 집계**

#### 🟡 Medium Priority
- [ ] **[list_repos N+1]** 3쿼리 + seen set — UNION 으로 통합
- [ ] **[UC 실패 silent]** `data_size=None` 만 반환 — 실패 이유 로깅

### 2.7 `routers/files.py` ⚠️ 최대 복잡도

#### 🔴 High Priority
- [ ] **[세션 생성 중복]** `upload_init`, `upload_init_cab`, `upload_stream_open` 에 동일 코드 3중. **→ `_create_upload_session()` 추출**
- [ ] **[upload_complete 부분 실패]** 병렬 `_link_one` 중 일부 실패 → session 상태 혼합. **→ 모두 실패 or 모두 성공 원자성**
- [ ] **[download resolve race]** GCS 객체 존재 확인 후 resolve 사이 삭제되면 409 → 재시도 시 동일 에러. **→ 즉시 재확인 루프**
- [ ] **[stream_stage 재사용 모호]** 같은 remote_path 재호출 시 physical_address 재사용 vs 덮어쓰기 불명확. **→ 정책 명문화**
- [ ] **[다운로드 모드 간 호출 방식 불일치]** 직렬/병렬 혼재. **→ 공통 헬퍼**
- [ ] **[UC sync 실패 silent]** `upload_complete`, `upload_stream_commit` 에서 warning 만. **→ session 상태에 `uc_sync_status` 필드 추가**

#### 🟡 Medium Priority
- [ ] **[Signed URL orphan]** 2시간 유효 signed URL 후 실패 시 GCS 고아 파일. **→ TTL cleanup job**
- [ ] **[_parallel_map 워커 설정]** 기본값 부재 시 하드코딩. **→ config 값 필수**
- [ ] **[migrate size_bytes=0]** 서버사이드 복사 후 크기 미조회. **→ `blob.reload()`**
- [ ] **[migrate 리니지 중복]** 중복 확인 없음. **→ upsert**
- [ ] **[ls vs download iter 불일치]** `iter_physical_paths` 와 `list_objects` 혼용

#### 🟢 Nice-to-have
- [ ] **[stream_stage 진행률 반환]**
- [ ] **[download default 만료 시간]**
- [ ] **[copy_stream_page metadata 검증]**
- [ ] **[commit_message 누락 처리]**
- [ ] **[table_name 매핑 규칙]**

### 2.8 `routers/versioning.py`

#### 🔴 High Priority
- [ ] **[merge UC sync silent]** files.py 와 동일 — 실패 상태 반환 필요
- [ ] **[merge 충돌 감지]** LakeFS 충돌 시 일부 진행 가능성. **→ 트랜잭션 검증**

#### 🟡 Medium Priority
- [ ] **[브랜치 생성/삭제 race]** 동시 요청 중복 키 미처리
- [ ] **[get_commit_log 페이지네이션]** 기본 30개만, 이후 접근 불가

#### 🟢 Nice-to-have
- [ ] **[_sync_uc_on_merge 기존 메타 보존]**
- [ ] **[diff 스트리밍]**

### 2.9 `routers/catalog.py`

#### 🔴 High Priority
- [ ] **[search 전수 스캔]** `catalog × schema × table` 순회. **→ UC 쿼리 API or ES 인덱스**
- [ ] **[search 페이지네이션 메타 없음]** `has_more`, `next_offset` 부재. **→ 스키마에 추가**
- [ ] **[권한 필터링 레이스]** 후처리 필터링 → 결과 부족 방어 없음. **→ DB 단계에서 필터**
- [ ] **[get_table 예외 범위 과다]** `except Exception` — UC 다운 vs 404 무구별
- [ ] **[update_metadata 부분 실패]** DELETE 후 CREATE upsert — UC 호출 실패 시 데이터 소실
- [ ] **[_get_accessible_repo_names 3쿼리]** 매 호출 — UNION 통합
- [ ] **[audit-logs repo 필터 substring]** `resource_id in log.repo_name` — "my-repo" / "my-repo-2" 충돌. **→ exact match**

#### 🟡 Medium Priority
- [ ] **[filters 캐싱 없음]** `get_filter_options` 매번 full-scan
- [ ] **[table → repo 추론]** underscore→hyphen 변환 휴리스틱 취약

#### 🟢 Nice-to-have
- [ ] **[읽기 작업 audit]** 민감도 분류

### 2.10 `routers/lineage.py`

#### 🔴 High Priority
- [ ] **[graph 크기 제한 없음]** 전체 `RepoLineage` 로드 → 10K 노드면 메모리 폭발. **→ `max_depth`, `max_nodes` 파라미터**
- [ ] **[graph N+1]** 각 repo_name 개별 쿼리. **→ `IN` 조건**
- [ ] **[delete 권한만 검증]** repo 존재 검증 누락

#### 🟡 Medium Priority
- [ ] **[사이클 검증 없음]** A→B→C→A
- [ ] **[relation_type DB CHECK 없음]**

### 2.11 `routers/dashboard.py`

#### 🔴 High Priority
- [ ] **[stats 캐싱 부재]** 매 요청 full-scan × 3. **→ Redis 5~10분 TTL**
- [ ] **[recent_activity 보안]** 모든 유저 활동 노출. **→ 통계만 또는 본인 활동만**

#### 🟡 Medium Priority
- [ ] **[응답 크기 고정 20]** pagination 필요

### 2.12 `routers/health.py`

#### 🔴 High Priority
- [ ] **[UC 타임아웃 30초]** health check 자체가 지연됨. **→ 5초**
- [ ] **[DB 에러 메시지 노출]** connection string 포함 가능. **→ 마스킹**

#### 🟡 Medium Priority
- [ ] **[status 구분]** ok/degraded 2단계만 — "critical" 추가

### 2.13 `routers/metrics.py`

#### 🔴 High Priority
- [ ] **[카디널리티 폭발]** 경로 템플릿 미정규화 가능성. **→ `/repos/{repo}` 수준으로 bucketing**

#### 🟡 Medium Priority
- [ ] **[인증 없음]** 통계 공개 노출. **→ admin-only**
- [ ] **[렌더링 성능]** 캐싱 가능

---

## 3. 서비스 레이어 추가 이슈

### `services/lakefs.py`

#### 🔴 High Priority
- [ ] **[link_physical_address checksum 미검증]** GCS etag 와 클라 체크섬 대조 없음. **→ 무결성 검증**

#### 🟡 Medium Priority
- [ ] **[list_objects max_items=1000 고정]** caller limit 충돌
- [ ] **[get_object_content range 미지원]**

### `services/unity_catalog.py`

#### 🔴 High Priority
- [ ] **[search 타임아웃 전파 없음]** 대량 테이블 시 클라 기다림. **→ context timeout**
- [ ] **[update_metadata 원자성]** DELETE → CREATE, 중간 실패 시 소실. **→ PATCH 또는 트랜잭션 래핑**
- [ ] **[get_filter_options max_results=10000]** 메모리 이슈

#### 🟡 Medium Priority
- [ ] **[HTTP 에러 재시도 없음]** 502/503 시 즉시 실패
- [ ] **[full_name 하드코딩 조립]** API 응답 우선 사용

---

## 4. Top 10 — 바로 착수 가능 순

| # | 위치 | 이슈 | 난이도 | 영향 |
|---|------|------|:------:|:----:|
| 1 | `dependencies._authenticate_api_key` | API key prefix 길이 가정 어긋남 | 낮 | 보안 |
| 2 | `users.get_user_profile` | LIKE injection + username 충돌 | 낮 | 보안 |
| 3 | `health.control_plane` | 30초 타임아웃 + DB 에러 노출 | 낮 | UX/보안 |
| 4 | `metrics.router` | 인증 없음 | 낮 | 보안 |
| 5 | `permissions` / `organizations.*members` | 미존재 email 자동 유저 생성 | 낮 | UX |
| 6 | `repos.delete_repo` | 외부 삭제 실패 후 DB row 삭제 | 중 | 일관성 |
| 7 | `files.upload_complete` / `versioning.merge` | UC sync 실패 silent | 중 | 일관성 |
| 8 | `dashboard.stats` | 매 호출 full-scan | 중 | 성능 |
| 9 | `lineage.graph` | 전체 로드 + N+1 | 중 | 성능/메모리 |
| 10 | `catalog.search` | O(n) 전수 스캔 | 높 | 성능 |

---

## 5. PR 묶음 제안

대규모로 한 번에 하지 말고 **5개 묶음**으로 분할. 각 묶음은 독립 PR.

### A. **Auth Hardening** (1-2일)
- API key prefix 계산 교정 + 고정 길이 보장
- JWT 예외 타입 분리 (expired vs invalid)
- Device flow TTL 설정화
- Email/role whitelist 검증 (EmailStr, Literal)
- Response model 누락 엔드포인트 일괄 지정

### B. **3-way Orchestration 복구** (3-5일)
- `repos.delete` 순서 변경 (외부 → DB)
- `files.upload_*`, `versioning.merge` 에 UC sync 상태 플래그
- 백그라운드 reconciler 도입 (실패 기록 테이블)
- `migrate` 멱등성 + 크기 조회

### C. **검색·통계 성능** (3-7일)
- `catalog.search` UC 쿼리 레벨 필터링 + 페이지네이션 메타
- `lineage.graph` depth/node cap + IN 쿼리
- `dashboard.stats` Redis 캐싱
- `get_filter_options` 캐싱

### D. **입력 검증 통일** (1-2일)
- Pydantic `EmailStr`, `Literal[...]` 전면
- `escape_like` 유틸로 LIKE 주입 방어
- `role` 문자열 상수화 + DB CHECK 제약

### E. **관측성·에러 정책** (1-2일)
- 에러 응답 스키마 표준화 (`{code, message, request_id}`)
- 내부 에러 메시지 마스킹 (`health.control_plane` 등)
- Audit 로깅 범위 확대 (`device_*`, `stats` 등)
- `metrics` 엔드포인트 인증

---

## 6. 관리 규칙

- **체크박스 업데이트**: MR 머지 시 `[ ]` → `[x]` + MR 링크
- **신규 발견**: 이 문서에 추가하되 우선순위 태깅 필수
- **재평가 주기**: 분기마다 우선순위 재검토

---

## 7. 부록 — 감사 방법

이 문서는 3명의 리뷰어가 다음 3개 그룹으로 나누어 독립 감사한 결과를 취합:

1. **Auth/권한/조직**: `auth`, `dependencies`, `users`, `permissions`, `organizations`
2. **레포/파일/버전**: `repos`, `files`, `versioning` + 서비스 `lakefs`, `gcs`, `cab`
3. **조회·관측성**: `catalog`, `lineage`, `dashboard`, `health`, `metrics` + 서비스 `unity_catalog`

각 감사는 입력검증 / 인증인가 / 에러처리 / 트랜잭션 / N+1 / 감사로깅 / 응답스키마 /
하드코딩 / 보안 / 테스트가능성 10개 점검 항목 기준.
