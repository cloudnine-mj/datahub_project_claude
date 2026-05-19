# 데이터 대시보드 탭별 개발 방향 설계

> 데이터 대시보드 세부 탭(데이터 자산, 프로젝트 데이터, 레포지토리 그래프) 개발 방향 — 검토용
>
> RBAC 기반 권한 모델 적용을 전제로, Owner/Maintainer 역할의 사용자가
> 프로젝트 내 데이터를 관리하고 활용하기 쉽게 정보를 파악하는 관점에서 설계

---

## 현재 구조

```
Project → Plan(기획서) → LakeFS Repo 자동 생성 → UC Catalog 메타데이터
                       → ConstructionReport(보고서)
```

- Plan 생성 시 `Plan.dataName`으로 LakeFS repo가 자동 생성됨
- 포털 DB(Prisma)에는 Project-Plan 관계가 존재
- Repo 권한(permission)은 Platform API 측에서 관리
- RBAC 적용 후 repo별 visibility(public/private)와 역할 정보 사용 가능

---

## 1. 데이터 자산 탭 (기존 내용 + 확장)

### 현재

전체 데이터셋의 통계 차트 (Modality, 조직, Task, Tier 분포)

### 확장 방향: "내가 관리하는 데이터" 중심 뷰 추가

```
┌─────────────────────────────────────────────────────────┐
│  내 데이터 자산 요약                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Owner    │  │Maintainer│  │ Public   │  │ Private  │ │
│  │   12개   │  │    5개   │  │   14개   │  │    3개   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
├─────────────────────────────────────────────────────────┤
│  [기존 전체 통계 차트들]                                    │
│  Modality 분포 | 조직별 | Task 분포 | Tier 분포            │
│  → 필터 추가: "내 데이터만" 토글                             │
└─────────────────────────────────────────────────────────┘
```

### 주요 기능

- 상단에 **내 역할별 repo 수**, **visibility별 repo 수** KPI 카드 추가
- 기존 차트에 "내 데이터만 보기" 필터 토글
- Owner/Maintainer인 repo의 데이터 품질 현황 (Data Card Tier 미지정 비율 등)

---

## 2. 프로젝트 데이터 탭 (신규)

### 목적

내가 Owner/Maintainer인 repo를 프로젝트 단위로 묶어서 관리 현황 파악

### 화면 구성

```
┌─────────────────────────────────────────────────────────┐
│  프로젝트 선택: [▼ Project A]  [▼ 전체 상태]               │
├─────────────────────────────────────────────────────────┤
│  Project A  (PM: 홍길동 | TM: 김철수)                      │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 레포지토리        역할    Visibility  상태    용량    │ │
│  │ ─────────────────────────────────────────────────── │ │
│  │ speech-dataset    Owner   public     완료     2.3GB │ │
│  │ text-corpus-v2    Owner   private    진행중   540MB │ │
│  │ image-annotation  Maint.  public     기획    —     │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                          │
│  프로젝트 데이터 현황                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ 기획 대비   │  │ Visibility │  │ 권한 분포          │  │
│  │ 완료율 67%  │  │ ◉ pub  2  │  │ Developer  5명    │  │
│  │ ████░░     │  │ ◉ priv 1  │  │ Guest      3명    │  │
│  └────────────┘  └────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 주요 기능

- **프로젝트별 repo 목록** — Plan/Report 상태, visibility, 역할, 데이터 크기
- **프로젝트 진행 현황** — 기획(Plan) 대비 완료(Report) 비율
- **권한 현황** — 프로젝트 내 repo에 할당된 사용자 수/역할 분포
- **빠른 액션** — visibility 변경, 권한 부여 (Owner/Maintainer만 노출)

---

## 3. 레포지토리 그래프 탭 (신규)

### 목적

- 단일 repo의 **브랜치/커밋 버전 그래프** 확인
- 여러 repo 간의 **데이터 리니지(원본→파생)** 시각화
- 프로젝트/조직 관점의 repo 관계 파악

### 보기 모드

| 모드 | 범위 | 설명 |
|------|------|------|
| **버전 그래프** | 단일 repo | 브랜치/커밋 히스토리를 Git-style 그래프로 시각화 |
| **데이터 리니지** | repo 간 | 원본→파생 관계를 DAG로 시각화 |
| **프로젝트-레포 관계** | 프로젝트 단위 | 프로젝트별 repo 트리 |
| **조직-레포 관계** | 조직 단위 | Lab/TechCell별 repo 분포 |

### 버전 그래프 뷰

단일 repo를 선택하면 해당 repo의 브랜치/커밋 히스토리를 Git-style 그래프로 보여준다.
LakeFS의 branch, commit, merge 정보를 활용한다.

```
┌─────────────────────────────────────────────────────────────────┐
│  보기 모드: [● 버전 그래프] [데이터 리니지] [프로젝트-레포] [조직]  │
│  레포지토리: [▼ speech-dataset]                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  main          feature/cleaning     feature/augment             │
│   │                  │                   │                      │
│   ● init commit      │                   │                      │
│   │                  │                   │                      │
│   ● upload raw v1    │                   │                      │
│   │\                 │                   │                      │
│   │ ● ─── branch ───→● add noise filter │                      │
│   │                  │                   │                      │
│   │                  ● fix encoding      │                      │
│   │                  │                   │                      │
│   │←── merge ────────●                   │                      │
│   ● merged cleaning  │                   │                      │
│   │\                                     │                      │
│   │ ● ─── branch ──────────────────────→ ● augment v1          │
│   │                                      │                      │
│   │                                      ● add samples          │
│   │                                      │                      │
│   │←── merge ────────────────────────────●                      │
│   ● merged augment (latest)                                     │
│                                                                 │
│  ─── 범례 ──────────────────────────────────                    │
│  ● commit   ──→ branch   ←── merge   ▣ tag                     │
│  클릭 시: 커밋 상세 (메시지, 작성자, 시간, 변경 파일 목록)           │
└─────────────────────────────────────────────────────────────────┘
```

#### 주요 기능

- **브랜치별 커밋 히스토리** — 브랜치 분기/머지를 시각적으로 표현
- **커밋 노드 클릭** — 커밋 메시지, 작성자, 시간, 변경된 파일 목록 표시
- **브랜치 비교** — 두 브랜치 간 diff 요약 (변경 파일 수, 추가/삭제)
- **버전 간 데이터 변화 추적** — 커밋별 데이터 크기 변화, 파일 수 변화 표시
- **리니지 뷰 연동** — 버전 그래프에서 특정 커밋 선택 → 해당 시점의 repo 간 리니지 확인

---

### 데이터 리니지 뷰

repo 생성(Plan 작성) 시 **원본 레포지토리(source repos)**를 선택할 수 있도록 하여,
raw data → 가공 데이터 → 최종 데이터셋 간의 계보를 추적한다.

```
┌─────────────────────────────────────────────────────────────────┐
│  보기 모드: [● 데이터 리니지] [프로젝트-레포] [조직-레포]          │
│  필터: [▼ 내 데이터만] [▼ 프로젝트]                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │ raw-speech   │────→│ speech-clean  │────→│ speech-final │    │
│  │ (raw)        │     │ (processed)  │     │ (curated)    │    │
│  │ Owner: 김철수 │     │ Owner: 김철수 │     │ Owner: 이영희 │    │
│  │ public 4.2GB │     │ public 2.1GB │     │ private 1.8GB│    │
│  └──────────────┘     └──────┬───────┘     └──────────────┘    │
│                              │                                  │
│                              ▼                                  │
│                       ┌──────────────┐                          │
│                       │ speech-aug   │                          │
│                       │ (augmented)  │                          │
│                       │ Owner: 박민수 │                          │
│                       │ public 3.5GB │                          │
│                       └──────────────┘                          │
│                                                                 │
│  ─── 범례 ─────────────────────────────────────────             │
│  ◉ public  ◉ private  ──→ derived from  노드 크기 = 데이터 용량  │
│  클릭 시 상세 패널: 메타데이터, 최근 커밋, 권한 목록, 리니지 경로    │
└─────────────────────────────────────────────────────────────────┘
```

### 프로젝트-레포 관계 뷰

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│         ┌─Project A─┐                                   │
│         │           │                                   │
│    ┌────┴───┐  ┌────┴───┐                               │
│    │repo-1  │  │repo-2  │                               │
│    │(Owner) │  │(Maint.)│                               │
│    │public  │  │private │                               │
│    │2.3GB   │  │540MB   │                               │
│    └───┬────┘  └───┬────┘                               │
│        │           │                                    │
│   ┌────┴────┐ ┌────┴────┐                               │
│   │Dev: 3명 │ │Dev: 2명 │                               │
│   │Guest:1명│ │Guest:0명│                               │
│   └─────────┘ └─────────┘                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 전체 주요 기능 요약

| 뷰 | 핵심 기능 |
|----|----------|
| **버전 그래프** | 단일 repo의 브랜치/커밋 히스토리를 Git-style DAG로 렌더링. 커밋 클릭 시 상세 정보 |
| **데이터 리니지** | repo 간 원본→파생 관계를 DAG로 렌더링. upstream/downstream 경로 하이라이트 |
| **프로젝트-레포** | 프로젝트별 repo 트리, 노드 크기=데이터 용량, 색상=visibility |
| **조직-레포** | Lab/TechCell별 repo 분포 |

- **뷰 간 연동** — 리니지 뷰에서 repo 노드 더블클릭 → 해당 repo의 버전 그래프로 전환
- 노드 클릭 시 상세 정보 패널 (repo 메타데이터, 최근 커밋, 권한 목록)

### 리니지를 위한 데이터 모델 변경

#### Platform API — repos 테이블

```sql
-- repo 간 파생 관계를 저장하는 테이블
CREATE TABLE repo_lineage (
    id            SERIAL PRIMARY KEY,
    source_repo_id  INTEGER NOT NULL REFERENCES repos(id),
    derived_repo_id INTEGER NOT NULL REFERENCES repos(id),
    relation_type   VARCHAR NOT NULL DEFAULT 'derived_from',
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(source_repo_id, derived_repo_id)
);
-- relation_type: 'derived_from' | 'augmented_from' | 'filtered_from' | 'merged_from'
```

#### Platform API — 신규 엔드포인트

| 엔드포인트 | Method | 설명 |
|-----------|--------|------|
| `/repos/{repo}/lineage` | GET | 해당 repo의 upstream/downstream 관계 조회 |
| `/repos/{repo}/lineage` | POST | 파생 관계 등록 (source_repo 지정) |
| `/repos/{repo}/lineage/{id}` | DELETE | 파생 관계 삭제 |
| `/lineage/graph` | GET | 전체 또는 필터된 리니지 그래프 조회 |

#### 포털 — Plan 생성 시 원본 repo 선택

Plan(기획서) 작성 화면에서 **원본 레포지토리** 필드 추가:
- 기존 repo 목록에서 다중 선택 가능
- 선택 시 relation_type 지정 (파생/증강/필터링/병합)
- Plan 생성 → repo 생성 → lineage POST 자동 호출

---

## API 연동 요구사항

| 필요 데이터 | 소스 | 비고 |
|------------|------|------|
| 내 역할별 repo 목록 | Platform API `GET /repos` + permissions | RBAC 적용 후 사용 가능 |
| Repo visibility | Platform API `repos.visibility` | RBAC 적용 후 추가되는 필드 |
| Repo별 권한 목록 | Platform API `GET /repos/{repo}/permissions` | Owner/Maintainer만 조회 가능 |
| 프로젝트-Plan 매핑 | 포털 DB (Prisma) `Plan.projectId` | 이미 존재 |
| Plan-Repo 매핑 | `Plan.dataName` → repo name | Plan 생성 시 repo 자동 생성 |
| 데이터 크기/파일 수 | Platform API catalog metadata | `data_size`, `data_count` |
| Repo 간 리니지 관계 | Platform API `GET /lineage/graph` | 신규 — repo_lineage 테이블 |
| 브랜치 목록 | Platform API `GET /repos/{repo}/branches` | 이미 존재 |
| 커밋 히스토리 | Platform API `GET /repos/{repo}/commits` | 이미 존재 (ref별 조회) |
| 브랜치 간 diff | Platform API `GET /repos/{repo}/diff` | 이미 존재 |

---

## 개발 순서

```
Phase 1 — Platform API RBAC 배포 후
  ├─ 포털에 /api/catalog/my-repos 프록시 API 추가
  │  (내 역할별 repo 목록 + visibility 조회)
  └─ 데이터 자산 탭: "내 데이터" KPI 카드 추가

Phase 2
  ├─ Plan-Repo 조인 API 구현
  │  (Prisma Plan + Platform repo 정보 결합)
  └─ 프로젝트 데이터 탭: 프로젝트별 repo 목록 + 진행 현황

Phase 3
  ├─ 권한 조회 프록시 API 추가
  └─ 프로젝트 데이터 탭: 권한 현황 + 빠른 액션 (visibility 변경 등)

Phase 4 — 레포지토리 그래프 탭: 버전 그래프
  ├─ 버전 그래프 뷰 구현 (브랜치/커밋 API는 이미 존재)
  │  (branches + commits + diff API 활용)
  └─ repo 선택 → Git-style DAG 렌더링, 커밋 상세 패널

Phase 5 — Platform API 리니지 기능 배포 후
  ├─ repo_lineage 테이블 + 리니지 API 구현 (Platform API 측)
  ├─ Plan 생성 화면에 원본 repo 선택 필드 추가
  ├─ 레포지토리 그래프 탭: 데이터 리니지 DAG + 프로젝트/조직 뷰
  └─ 뷰 간 연동: 리니지 노드 더블클릭 → 버전 그래프 전환
```
