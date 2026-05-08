# Authorization 동작 로직

> 권한 판별이 코드에서 어떻게 흐르는지 설명하는 문서

---

## 1. 역할 계층

```
Owner (40)  >  Maintainer (30)  >  Developer (20)  >  Guest (10)  >  Normal User (-)
```

- 숫자는 `ROLE_HIERARCHY` 값. 상위 역할은 하위 역할의 모든 권한을 포함한다.
- Normal User는 계층 값이 없으며, permissions 테이블에 레코드가 **없는** 인증된 사용자를 뜻한다.

---

## 2. 역할 판별 흐름 (`resolve_role`)

모든 권한 체크의 시작점. 사용자가 특정 Repo에서 어떤 역할인지 결정한다.

```
요청 사용자 + Repo
    │
    ├─ repos.owner_id == user.id ?
    │       → Yes: "owner" 반환
    │
    ├─ permissions 테이블에 (repo_name, user_id) 레코드 있음?
    │       → Yes: 해당 role 반환 ("maintainer" | "developer" | "guest")
    │
    └─ 해당 없음
            → None 반환 (Normal User)
```

**코드 위치:** `app/services/authorization.py` → `resolve_role()`

---

## 3. 접근 제어 흐름 (`check_access`)

API 엔드포인트에서 호출하는 핵심 함수. `min_role` 파라미터로 최소 요구 역할을 지정한다.

```
check_access(db, user, repo_name, min_role)
    │
    ├─ Repo가 DB에 없음?
    │       → 404 Not Found
    │
    ├─ resolve_role() 호출하여 사용자 역할 판별
    │
    ├─ 역할이 있는 사용자 (owner/maintainer/developer/guest)?
    │       ├─ ROLE_HIERARCHY[역할] >= ROLE_HIERARCHY[min_role]
    │       │       → ✅ 통과, Repo 반환
    │       └─ 미달
    │               → 403 "Requires '{min_role}' role or above"
    │
    └─ Normal User (역할 None)?
            ├─ Public Repo + min_role == "guest"
            │       → ✅ 통과 (읽기 허용)
            ├─ Private Repo
            │       → 403 "This is a private repository"
            └─ min_role > "guest" (쓰기 이상 요구)
                    → 403 "Requires '{min_role}' role or above"
```

### min_role별 의미

| min_role | 용도 | Normal User (Public) | Normal User (Private) |
|----------|------|---------------------|-----------------------|
| `guest` | 읽기 (ls, download, content, branches 조회) | ✅ 허용 | ❌ 차단 |
| `developer` | 쓰기 (upload, commit, merge, branch 생성/삭제) | ❌ 차단 | ❌ 차단 |
| `maintainer` | 관리 (권한 부여/회수, visibility 변경, audit-logs) | ❌ 차단 | ❌ 차단 |
| `owner` | 소유자 전용 (repo 삭제) | ❌ 차단 | ❌ 차단 |

**코드 위치:** `app/services/authorization.py` → `check_access()`

---

## 4. 권한 부여/회수 로직 (`can_assign_role`)

권한 관리 엔드포인트(`PUT/DELETE /repos/{repo}/permissions`)에서 호출된다.

```
can_assign_role(actor_role, target_role)
    │
    ├─ target_role이 assignable이 아님? (owner 등)
    │       → False
    │
    ├─ actor가 Owner?
    │       → True (maintainer, developer, guest 모두 부여 가능)
    │
    ├─ actor가 Maintainer?
    │       → target_level <= maintainer_level 이면 True
    │         (maintainer, developer, guest 부여 가능)
    │
    └─ 그 외 (developer, guest)
            → False (부여 불가)
```

### 추가 제약 (permissions 라우터에서 체크)

- 자기 자신에게 부여/회수 불가
- Owner(repos.owner_id)에게는 부여/회수 불가 (Owner는 permissions 테이블이 아닌 repos.owner_id로 관리)
- 기존 권한이 actor보다 높은 사용자의 권한 변경 불가

**코드 위치:** `app/services/authorization.py` → `can_assign_role()`, `app/routers/permissions.py`

---

## 5. 엔드포인트별 호출 관계

### Repo 관리 (`app/routers/repos.py`)

```
POST   /repos                    → 인증만 (get_current_user)
DELETE /repos/{repo}              → owner_id == user.id 직접 체크
PATCH  /repos/{repo}/visibility   → require_admin() = check_access(min_role="maintainer")
GET    /repos                     → 인증만 (목록에서 private repo는 권한 없으면 숨김)
```

### 권한 관리 (`app/routers/permissions.py`)

```
PUT    /repos/{repo}/permissions        → require_admin() + can_assign_role()
DELETE /repos/{repo}/permissions/{email} → require_admin() + can_assign_role()
GET    /repos/{repo}/permissions        → require_admin()
```

### 파일 (`app/routers/files.py`)

```
GET    /repos/{repo}/ls              → check_access(min_role="guest")
GET    /repos/{repo}/content         → check_access(min_role="guest")
POST   /repos/{repo}/download        → check_access(min_role="guest")
POST   /repos/{repo}/upload/init     → check_access(min_role="developer")
POST   /repos/{repo}/upload/complete → check_access(min_role="developer")
POST   /repos/{repo}/migrate         → 대상: check_access(min_role="developer")
                                       소스: check_access(min_role="guest")
```

### 버전 관리 (`app/routers/versioning.py`)

```
GET    /repos/{repo}/branches        → check_access(min_role="guest")
GET    /repos/{repo}/commits         → check_access(min_role="guest")
GET    /repos/{repo}/diff            → check_access(min_role="guest")
POST   /repos/{repo}/branches        → check_access(min_role="developer")
DELETE /repos/{repo}/branches/{name} → check_access(min_role="developer")
POST   /repos/{repo}/commits         → check_access(min_role="developer")
POST   /repos/{repo}/merge           → check_access(min_role="developer")
```

### 카탈로그 (`app/routers/catalog.py`)

```
GET    /catalog/filters              → 인증만
GET    /catalog/catalogs             → 인증만
GET    /catalog/search               → 인증만 (결과에서 private repo 테이블 필터링)
GET    /catalog/tables               → 인증만 (결과에서 private repo 테이블 필터링)
GET    /catalog/tables/{name}        → 인증만 (private repo면 역할 체크)
PATCH  /catalog/tables/{name}/metadata → check_access(min_role="developer")
POST   /repos/{repo}/enrich          → check_access(min_role="developer")
GET    /admin/audit-logs              → require_admin() + repo_name 필수
```

---

## 6. Private Repo 필터링 (카탈로그)

카탈로그 검색/목록 API는 Unity Catalog에서 전체 테이블을 가져온 뒤, 사용자가 접근 가능한 repo만 필터링한다.

```
접근 가능한 repo 집합 =
    소유 repo (repos.owner_id == user.id)
  ∪ 권한 부여받은 repo (permissions.user_id == user.id)
  ∪ Public repo (repos.visibility == 'public')

UC 테이블 목록에서:
    table_name → repo_name 변환 (underscore → hyphen)
    repo_name이 접근 가능 집합에 포함되면 결과에 포함
```

**코드 위치:** `app/routers/catalog.py` → `_get_accessible_repo_names()`, `_filter_tables_by_access()`

---

## 7. 실제 시나리오 예시

### A. Normal User가 Public Repo 파일을 다운로드

```
POST /repos/alpaca/download
    → check_access(db, user, "alpaca", min_role="guest")
    → resolve_role(): owner_id != user.id, permissions에 레코드 없음 → None
    → repo.visibility == "public" and min_role == "guest" → ✅ 통과
```

### B. Normal User가 Private Repo 파일을 다운로드

```
POST /repos/secret-data/download
    → check_access(db, user, "secret-data", min_role="guest")
    → resolve_role(): None (Normal User)
    → repo.visibility == "private" → 403 "This is a private repository"
```

### C. Guest가 Private Repo에 업로드 시도

```
POST /repos/secret-data/upload/init
    → check_access(db, user, "secret-data", min_role="developer")
    → resolve_role(): "guest"
    → ROLE_HIERARCHY["guest"]=10 < ROLE_HIERARCHY["developer"]=20
    → 403 "Requires 'developer' role or above (current: 'guest')"
```

### D. Maintainer가 다른 사용자에게 maintainer 부여

```
PUT /repos/alpaca/permissions  { email: "new@lgresearch.ai", role: "maintainer" }
    → require_admin(): resolve_role() = "maintainer" → level 30 >= 30 → ✅
    → can_assign_role("maintainer", "maintainer"):
        target_level(30) <= maintainer_level(30) → True → ✅
    → 권한 부여 성공
```

### E. Developer가 권한 부여 시도

```
PUT /repos/alpaca/permissions  { email: "someone@lgresearch.ai", role: "guest" }
    → require_admin(): resolve_role() = "developer" → level 20 < 30
    → 403 "Requires 'maintainer' role or above (current: 'developer')"
```
