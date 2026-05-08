# Authorization 설계 문서

> Repository 기반 역할 권한 정책 (RBAC) 설계안 — 검토용

---

## 1. 현재 상태 분석

### 기존 권한 모델

| 항목 | 현재 |
|------|------|
| 역할 | `owner` (repos.owner_id), `reader`, `writer` |
| Repo 공개 범위 | 없음 (모든 인증 사용자가 Public Repo 읽기 가능) |
| 권한 관리 주체 | Owner만 가능 |
| 카탈로그 접근제어 | **없음** — 인증만 되면 전체 조회/수정 가능 |
| 감사 로그 접근 | **없음** — 인증만 되면 전체 조회 가능 |

### 엔드포인트별 현재 권한 체크

| 엔드포인트 | 현재 체크 | 문제점 |
|-----------|----------|--------|
| `POST /repos` | 인증만 | — |
| `DELETE /repos/{repo}` | Owner | — |
| `PUT/DELETE/GET /repos/{repo}/permissions` | Owner | 위임 불가 |
| `GET ls`, `content`, `POST download` | reader 이상 | Private 개념 없음 |
| `POST upload/init`, `upload/complete` | writer 이상 | — |
| `POST/GET/DELETE branches`, `commits`, `merge`, `diff` | reader/writer 구분 | — |
| `GET catalog/search`, `tables` | 인증만 | **접근제어 없음** |
| `PATCH catalog/tables/{name}/metadata` | 인증만 | **아무나 수정 가능** |
| `POST /repos/{repo}/enrich` | 인증만 | **Repo 접근 체크 없음** |
| `GET /admin/audit-logs` | 인증만 | **관리자 체크 없음** |

### 코드 구조 문제

- `_check_repo_access()` 헬퍼가 `files.py`, `versioning.py`에 **중복 구현**되어 있음
- 권한 로직이 라우터마다 산재, 중앙 관리 포인트 없음

---

## 2. 목표 권한 모델

### 역할 정의

| 역할 | 부여 시점 | 설명 |
|------|----------|------|
| **Owner** | Repo 생성 시 자동 | Repo 생성자. 전체 권한 + 삭제 + 설정 |
| **Maintainer** | Owner가 지정 | 권한 관리 + Private 전환 + 전체 읽기/쓰기 |
| **Developer** | Owner/Maintainer가 지정 | 읽기 + 쓰기 (branch, upload, commit, merge) |
| **Guest** | Owner/Maintainer가 지정 | 읽기 전용 (ls, download, content, catalog 조회) |
| **Normal User** | 전사 구성원 (기본) | Public Repo 읽기만 가능. Private Repo 접근 불가 |

### Repo 공개 범위

| Visibility | 설명 |
|-----------|------|
| `public` (기본) | Normal User 포함 모든 인증 사용자가 읽기 가능 |
| `private` | Guest 이상 권한이 부여된 사용자만 접근 가능 |

- Owner와 Maintainer가 visibility를 변경할 수 있음
- Private 전환 시 기존 Normal User 접근은 즉시 차단됨

### 역할 계층

```
Owner > Maintainer > Developer > Guest > Normal User
```

- 상위 역할은 하위 역할의 모든 권한을 포함
- Normal User는 permissions 테이블에 레코드가 **없는** 인증된 사용자

### 권한 판별 로직

```
1. repo.owner_id == user.id  →  Owner
2. permissions 테이블 조회    →  maintainer / developer / guest
3. 레코드 없음 + public repo  →  Normal User (읽기만)
4. 레코드 없음 + private repo →  403 Forbidden
```

---

## 3. 엔드포인트별 최소 역할 매핑

### Repo 관리

| 엔드포인트 | Method | 최소 역할 | 비고 |
|-----------|--------|----------|------|
| `/repos` | POST | 인증된 사용자 | 생성자가 Owner |
| `/repos` | GET | 인증된 사용자 | 접근 가능한 Repo만 반환 |
| `/repos/{repo}` | DELETE | Owner | |
| `/repos/{repo}/visibility` | PATCH | Owner, Maintainer | public ↔ private 전환 |

### 권한 관리

| 엔드포인트 | Method | 최소 역할 | 비고 |
|-----------|--------|----------|------|
| `/repos/{repo}/permissions` | GET | Owner, Maintainer | 권한 목록 조회 |
| `/repos/{repo}/permissions` | PUT | Owner, Maintainer | 역할 부여 (guest/developer/maintainer) |
| `/repos/{repo}/permissions/{email}` | DELETE | Owner, Maintainer | 역할 회수 |

**제약 조건:**
- Owner는 모든 assignable 역할(maintainer, developer, guest)을 부여/회수 가능
- Maintainer는 자기 레벨 이하(maintainer, developer, guest)를 부여/회수 가능
- Owner 역할은 permissions 테이블이 아닌 `repos.owner_id`로 관리되므로 PUT으로 부여 불가
- 자기 자신의 권한은 변경 불가

### 파일 (files.py)

| 엔드포인트 | Method | 최소 역할 | Public Repo Normal User |
|-----------|--------|----------|------------------------|
| `/repos/{repo}/ls` | GET | Guest | 허용 (읽기) |
| `/repos/{repo}/content` | GET | Guest | 허용 (읽기) |
| `/repos/{repo}/download` | POST | Guest | 허용 (읽기) |
| `/repos/{repo}/upload/init` | POST | Developer | 불가 |
| `/repos/{repo}/upload/complete` | POST | Developer | 불가 |
| `/repos/{repo}/migrate` | POST | 소스: Guest / 대상: Developer | |

### 버전 관리 (versioning.py)

| 엔드포인트 | Method | 최소 역할 | Public Repo Normal User |
|-----------|--------|----------|------------------------|
| `/repos/{repo}/branches` | GET | Guest | 허용 |
| `/repos/{repo}/commits` | GET | Guest | 허용 |
| `/repos/{repo}/diff` | GET | Guest | 허용 |
| `/repos/{repo}/branches` | POST | Developer | 불가 |
| `/repos/{repo}/branches/{name}` | DELETE | Developer | 불가 |
| `/repos/{repo}/commits` | POST | Developer | 불가 |
| `/repos/{repo}/merge` | POST | Developer | 불가 |

### 카탈로그 (catalog.py)

| 엔드포인트 | Method | 최소 역할 | 비고 |
|-----------|--------|----------|------|
| `/catalog/filters` | GET | 인증된 사용자 | |
| `/catalog/catalogs` | GET | 인증된 사용자 | |
| `/catalog/search` | GET | 인증된 사용자 | **Private Repo 결과 필터링** |
| `/catalog/tables` | GET | 인증된 사용자 | **Private Repo 결과 필터링** |
| `/catalog/tables/{name}` | GET | Guest | Private Repo: Guest 이상 필요 |
| `/catalog/tables/{name}/metadata` | PATCH | Developer | |
| `/repos/{repo}/enrich` | POST | Developer | |

### 관리 기능

| 엔드포인트 | Method | 최소 역할 | 비고 |
|-----------|--------|----------|------|
| `/admin/audit-logs` | GET | Owner, Maintainer | 본인 관련 Repo 로그만 조회 |

---

## 4. DB 변경 사항

### repos 테이블 — visibility 컬럼 추가

```sql
ALTER TABLE repos ADD COLUMN visibility VARCHAR NOT NULL DEFAULT 'public';
ALTER TABLE repos ADD CONSTRAINT ck_repos_visibility
    CHECK (visibility IN ('public', 'private'));
```

### permissions 테이블 — role 제약조건 변경

```sql
-- 기존 데이터 마이그레이션
UPDATE permissions SET role = 'guest' WHERE role = 'reader';
UPDATE permissions SET role = 'developer' WHERE role = 'writer';

-- 제약조건 교체
ALTER TABLE permissions DROP CONSTRAINT ck_permissions_role;
ALTER TABLE permissions ADD CONSTRAINT ck_permissions_role
    CHECK (role IN ('maintainer', 'developer', 'guest'));
```

### Alembic 마이그레이션 파일

```
alembic/versions/003_rbac_roles.py
├── repos.visibility 컬럼 추가 (default='public')
├── permissions.role CHECK 제약조건 변경
└── 기존 데이터 변환: reader → guest, writer → developer
```

---

## 5. 코드 구조 변경

### 신규: `app/services/authorization.py`

중복된 `_check_repo_access()`, `_require_owner()`를 하나의 서비스로 통합.

```python
class AuthorizationService:
    """중앙 권한 판별 서비스"""

    @staticmethod
    def resolve_role(db, user, repo) -> str | None:
        """사용자의 Repo 내 역할을 반환
        Returns: 'owner' | 'maintainer' | 'developer' | 'guest' | None
        None = Normal User (DB에 권한 레코드 없음)
        """

    @staticmethod
    def check_access(db, user, repo_name, min_role: str) -> Repo:
        """최소 역할 요구. 미달 시 403 raise.
        - role 계층: owner > maintainer > developer > guest > None
        - None(Normal User) + public repo + min_role==guest → 허용
        - None(Normal User) + private repo → 403
        """

    @staticmethod
    def require_admin(db, user, repo_name) -> Repo:
        """Owner 또는 Maintainer만 통과"""
```

### 기존 라우터 변경

| 파일 | 변경 내용 |
|------|----------|
| `files.py` | `_check_repo_access()` 제거 → `AuthorizationService.check_access()` 호출 |
| `versioning.py` | `_check_repo_access()` 제거 → `AuthorizationService.check_access()` 호출 |
| `permissions.py` | `_require_owner()` 제거 → `AuthorizationService.require_admin()` 호출, role 값 변경 |
| `repos.py` | visibility PATCH 엔드포인트 추가 |
| `catalog.py` | 모든 엔드포인트에 접근제어 추가, 목록 조회 시 Private Repo 필터링 |

---

## 6. 개발 순서

```
Step 1.  DB 마이그레이션 (models.py + 003_rbac_roles.py)
         └─ repos.visibility, permissions.role 변경, 기존 데이터 변환

Step 2.  AuthorizationService 구현 (app/services/authorization.py)
         └─ resolve_role(), check_access(), require_admin()

Step 3.  permissions 라우터 수정
         └─ Maintainer 위임, role 값 변경 (maintainer/developer/guest)

Step 4.  repos 라우터 수정
         └─ visibility PATCH 엔드포인트 추가, 목록 조회 시 visibility 반영

Step 5.  files / versioning 라우터 권한 통합
         └─ 중복 헬퍼 제거, AuthorizationService 호출로 교체

Step 6.  catalog 라우터 접근제어 추가
         └─ Private Repo 필터링, 수정 권한 체크

Step 7.  admin/audit-logs 접근제어 추가

Step 8.  테스트 + 문서 업데이트
```

---

## 7. 역할별 권한 요약 매트릭스

```
기능                          Owner  Maintainer  Developer  Guest  Normal(Public)  Normal(Private)
─────────────────────────────────────────────────────────────────────────────────────────────────
Repo 삭제                      ✅      ❌          ❌        ❌        ❌              ❌
Visibility 변경                ✅      ✅          ❌        ❌        ❌              ❌
권한 부여/회수                  ✅      ✅*         ❌        ❌        ❌              ❌
파일 업로드/커밋/머지            ✅      ✅          ✅        ❌        ❌              ❌
브랜치 생성/삭제                ✅      ✅          ✅        ❌        ❌              ❌
메타데이터 수정                 ✅      ✅          ✅        ❌        ❌              ❌
AI Enrichment                  ✅      ✅          ✅        ❌        ❌              ❌
파일 조회/다운로드              ✅      ✅          ✅        ✅        ✅              ❌
브랜치/커밋/Diff 조회           ✅      ✅          ✅        ✅        ✅              ❌
카탈로그 조회                   ✅      ✅          ✅        ✅        ✅              ❌
감사 로그 조회                  ✅      ✅          ❌        ❌        ❌              ❌

* Owner는 maintainer/developer/guest 부여 가능, Maintainer는 maintainer/developer/guest 부여 가능
```
