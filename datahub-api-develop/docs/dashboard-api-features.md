# 대시보드 API 피쳐 개발 내역

> 데이터 대시보드(데이터 자산, 프로젝트 데이터, 레포지토리 그래프) 지원을 위한 Platform API 확장

---

## 1. 커밋 히스토리 — parents 필드 실값 제공

### 변경 전

```json
{ "id": "abc123", "parents": [] }  // 항상 빈 배열
```

### 변경 후

```json
{ "id": "abc123", "parents": ["def456", "ghi789"] }  // LakeFS에서 추출한 실제 parent ID
```

### 변경 파일

| 파일 | 내용 |
|------|------|
| `app/services/lakefs.py` | `CommitInfo` 데이터클래스에 `parents` 필드 추가. `get_commit_log()`에서 `c.parents` 추출 |
| `app/routers/versioning.py` | `parents=[]` 하드코딩 제거 → `c.parents or []` 전달 |

### 프론트엔드 활용

- **버전 그래프 DAG 렌더링**: 각 커밋의 parents를 따라 edge를 그리면 Git-style 커밋 그래프 구현 가능
- merge 커밋은 parents가 2개 이상 → 머지 포인트 시각화

---

## 2. 브랜치 목록 — HEAD 커밋 정보 포함

### 변경 전

```json
{ "branches": ["main", "feature/cleaning"] }  // 이름만
```

### 변경 후

```json
{
  "branches": [
    {
      "name": "main",
      "commit_id": "abc123",
      "commit_message": "merged cleaning",
      "commit_date": 1711234567
    },
    {
      "name": "feature/cleaning",
      "commit_id": "def456",
      "commit_message": "fix encoding",
      "commit_date": 1711230000
    }
  ]
}
```

### 변경 파일

| 파일 | 내용 |
|------|------|
| `app/services/lakefs.py` | `BranchInfo` 데이터클래스 신규. `list_branches()`가 SDK에서 `commit_id` + 커밋 상세 조회 |
| `app/schemas/versioning.py` | `BranchInfoResponse` 스키마 신규, `BranchListResponse` 변경 |
| `app/routers/versioning.py` | `BranchInfoResponse` 매핑하여 반환 |

### 프론트엔드 활용

- 브랜치 목록에서 각 브랜치의 최신 상태(마지막 커밋 메시지, 시간) 표시
- 버전 그래프에서 브랜치 HEAD 위치 표시

---

## 3. Diff — change type 포함

### 변경 전

```json
{ "paths": ["data/file1.csv", "data/file2.json"] }  // 경로만
```

### 변경 후

```json
{
  "entries": [
    { "path": "data/file1.csv", "change_type": "added", "path_type": "object", "size_bytes": 1024 },
    { "path": "data/file2.json", "change_type": "changed", "path_type": "object", "size_bytes": 512 },
    { "path": "data/old.txt", "change_type": "removed", "path_type": "object", "size_bytes": null }
  ]
}
```

### 변경 파일

| 파일 | 내용 |
|------|------|
| `app/services/lakefs.py` | `DiffEntry` 데이터클래스 신규. `diff_branch()`에서 `d.type` 매핑 (1=added, 2=removed, 3=changed) |
| `app/schemas/versioning.py` | `DiffEntryResponse` 스키마 신규, `DiffResponse.entries` 변경 |
| `app/routers/versioning.py` | `DiffEntryResponse` 매핑하여 반환 |

### 프론트엔드 활용

- 브랜치 비교 시 추가/삭제/수정 파일을 색상으로 구분 (초록/빨강/노랑)
- 커밋 상세에서 변경된 파일 목록과 유형 표시

### 주의: 응답 형태 변경 (Breaking Change)

기존 `DiffResponse.paths: list[str]` → `DiffResponse.entries: list[DiffEntryResponse]`

프론트엔드에서 diff API를 사용 중이라면 마이그레이션 필요.

---

## 4. Repo 통계 API (신규)

### 엔드포인트

```
GET /api/v1/repos/{repo_name}/stats
```

### 응답

```json
{
  "repo_name": "alpaca",
  "owner": "been@lgresearch.ai",
  "visibility": "public",
  "branch_count": 3,
  "commit_count": 15,
  "file_count": 42,
  "total_size_bytes": 2415919104,
  "data_size": "2.3 GB",
  "data_count": "150000",
  "last_commit_id": "abc123",
  "last_commit_message": "upload batch 3",
  "last_commit_date": 1711234567,
  "data_card_tier": "gold"
}
```

### 데이터 소스

| 필드 | 소스 |
|------|------|
| `branch_count` | LakeFS `list_branches()` |
| `commit_count` | LakeFS `get_commit_log()` (main, 최대 1000) |
| `file_count`, `total_size_bytes` | LakeFS `list_objects()` (main, recursive) |
| `last_commit_*` | LakeFS `get_commit_log()` (main, amount=1) |
| `data_size`, `data_count`, `data_card_tier` | Unity Catalog `properties` |

### 변경 파일

| 파일 | 내용 |
|------|------|
| `app/schemas/repos.py` | `RepoStatsResponse` 스키마 신규 |
| `app/routers/repos.py` | `GET /repos/{repo_name}/stats` 엔드포인트 신규 |

### 프론트엔드 활용

- 데이터 자산 탭: KPI 카드 (repo별 크기, 파일 수, 커밋 수)
- 프로젝트 데이터 탭: repo 목록의 용량/상태 컬럼
- repo 상세 페이지: 통계 헤더

### 권한

`guest` 이상 (Public Repo는 Normal User도 조회 가능)

---

## 5. 데이터 리니지 (신규)

### DB 모델

```sql
CREATE TABLE repo_lineage (
    id            SERIAL PRIMARY KEY,
    source_repo   VARCHAR(128) NOT NULL REFERENCES repos(repo_name),
    derived_repo  VARCHAR(128) NOT NULL REFERENCES repos(repo_name),
    relation_type VARCHAR(32)  NOT NULL DEFAULT 'derived_from',
    description   TEXT,
    created_by    INTEGER      NOT NULL REFERENCES users(id),
    created_at    TIMESTAMP    DEFAULT NOW(),
    UNIQUE(source_repo, derived_repo),
    CHECK(relation_type IN ('derived_from','augmented_from','filtered_from','merged_from'))
);
```

Alembic: `alembic/versions/004_repo_lineage.py`

### relation_type 종류

| 타입 | 의미 |
|------|------|
| `derived_from` | 원본 데이터에서 파생 |
| `augmented_from` | 원본 데이터를 증강 |
| `filtered_from` | 원본 데이터를 필터링/정제 |
| `merged_from` | 여러 원본을 병합 |

### 엔드포인트

| 엔드포인트 | Method | 권한 | 설명 |
|-----------|--------|------|------|
| `/api/v1/repos/{repo}/lineage` | GET | guest | upstream/downstream 조회 |
| `/api/v1/repos/{repo}/lineage` | POST | developer | 파생 관계 등록 |
| `/api/v1/repos/{repo}/lineage/{id}` | DELETE | developer | 파생 관계 삭제 |
| `/api/v1/lineage/graph` | GET | 인증 | 전체 리니지 그래프 (접근 가능한 repo만) |

### GET /repos/{repo}/lineage 응답

```json
{
  "upstream": [
    {
      "id": 1,
      "source_repo": "raw-speech",
      "derived_repo": "speech-clean",
      "relation_type": "derived_from",
      "description": "노이즈 제거 + 정규화",
      "created_by": "been@lgresearch.ai",
      "created_at": "2026-03-23T10:00:00"
    }
  ],
  "downstream": [
    {
      "id": 2,
      "source_repo": "speech-clean",
      "derived_repo": "speech-final",
      "relation_type": "filtered_from",
      "description": null,
      "created_by": "been@lgresearch.ai",
      "created_at": "2026-03-23T11:00:00"
    }
  ]
}
```

### GET /lineage/graph 응답

```json
{
  "nodes": [
    { "repo_name": "raw-speech", "owner": "been@lgresearch.ai", "visibility": "public" },
    { "repo_name": "speech-clean", "owner": "been@lgresearch.ai", "visibility": "public" },
    { "repo_name": "speech-final", "owner": "someone@lgresearch.ai", "visibility": "private" }
  ],
  "edges": [
    { "source": "raw-speech", "target": "speech-clean", "relation_type": "derived_from" },
    { "source": "speech-clean", "target": "speech-final", "relation_type": "filtered_from" }
  ]
}
```

### migrate 시 자동 리니지 등록

`POST /repos/{repo}/migrate` 호출 시 `source_repo → dest_repo` 리니지가 자동 생성됨.
- relation_type: `derived_from`
- 중복이면 무시

### 변경 파일

| 파일 | 내용 |
|------|------|
| `app/models.py` | `RepoLineage` 모델 신규 |
| `alembic/versions/004_repo_lineage.py` | 마이그레이션 |
| `app/schemas/lineage.py` | 전체 신규 |
| `app/routers/lineage.py` | 전체 신규 |
| `app/routers/files.py` | migrate 엔드포인트에 리니지 자동 등록 추가 |
| `app/main.py` | lineage 라우터 등록 |

### 프론트엔드 활용

- **리니지 DAG 뷰**: `GET /lineage/graph`의 nodes/edges로 방향성 그래프 렌더링
- **repo 상세**: `GET /repos/{repo}/lineage`로 upstream(원본)/downstream(파생) 표시
- **Plan 생성 시**: 원본 repo 선택 후 `POST /repos/{new_repo}/lineage`로 관계 등록

---

## 전체 변경 파일 요약

| 파일 | 변경 유형 |
|------|----------|
| `app/services/lakefs.py` | 수정 — CommitInfo.parents, BranchInfo, DiffEntry 추가 |
| `app/schemas/versioning.py` | 수정 — BranchInfoResponse, DiffEntryResponse 신규 |
| `app/schemas/repos.py` | 수정 — RepoStatsResponse 신규 |
| `app/schemas/lineage.py` | **신규** |
| `app/routers/versioning.py` | 수정 — 실제 데이터 매핑 |
| `app/routers/repos.py` | 수정 — stats 엔드포인트 추가 |
| `app/routers/files.py` | 수정 — migrate 시 리니지 자동 등록 |
| `app/routers/lineage.py` | **신규** |
| `app/models.py` | 수정 — RepoLineage 모델 추가 |
| `app/main.py` | 수정 — lineage 라우터 등록 |
| `alembic/versions/004_repo_lineage.py` | **신규** |

---

## Alembic 마이그레이션 순서

```
002 (현재 운영) → 003_rbac_roles (RBAC) → 004_repo_lineage (리니지)
```

배포 시 `alembic upgrade head`로 003, 004가 순차 적용됨.
