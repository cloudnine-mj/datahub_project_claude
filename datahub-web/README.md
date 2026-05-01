# DataHub Governance Web

LG AI DataHub **Governance 탭** — 백엔드(FastAPI + SQLite) + 프론트엔드(Next.js 14).

사내 인프라/네트워크 의존 없이 로컬에서 즉시 실행 가능합니다.

## 구조

```
datahub-web/
├── backend/        FastAPI + SQLAlchemy + SQLite (포트 8000)
│   ├── app/
│   │   ├── api/routes/  me, posts, forms
│   │   ├── models/      User / Post / Form
│   │   ├── schemas/     Pydantic
│   │   ├── seed.py      화면 캡처 데이터 시드
│   │   ├── config.py
│   │   └── main.py
│   └── pyproject.toml
└── frontend/       Next.js 14 (App Router) + Tailwind (포트 3000)
    ├── src/
    │   ├── app/governance/                Governance 인덱스 + 게시판/신청서 라우팅
    │   ├── components/                    Sidebar/Topbar/FormBuilder 등
    │   └── lib/api.ts, formSchemas.ts
    └── package.json
```

## 빠른 실행

### 1. Backend (필수, 먼저)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

* http://localhost:8000/docs — Swagger UI
* http://localhost:8000/health — 헬스체크
* 최초 실행 시 `governance.db` 생성 + 시드 데이터(화면 캡처와 동일) 자동 삽입

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

* http://localhost:3000 → http://localhost:3000/governance 자동 리다이렉트
* `/api/*` 호출은 `next.config.js` rewrites 로 `localhost:8000` 으로 프록시 (CORS 무관)

## 사용자 권한 / 화면 12 (글쓰기 권한 없음) 테스트

브라우저 콘솔에서:

```js
// admin (Karlo Lee, 모든 게시판 글쓰기 가능) — 기본
localStorage.removeItem("datahub-user-email");

// editor (글쓰기 가능)
localStorage.setItem("datahub-user-email", "siu@example.com");

// viewer (글쓰기 불가 → 화면 12 트리거)
localStorage.setItem("datahub-user-email", "viewer@example.com");
```

설정 후 새로고침하면 사이드바 사용자 표시가 바뀌고, viewer 일 때 글쓰기 버튼 클릭 시 권한없음 화면으로 이동합니다.

## 화면 ↔ 라우트 매핑

| # | 화면 | 라우트 |
|---|---|---|
| 1 | Governance 인덱스 (4 카드) | `/governance` |
| 2 | 데이터 관리 정책 게시판 | `/governance/policy` |
| 3 | 데이터 제작 프로세스 게시판 | `/governance/process/production` |
| 4 | 데이터 활용 요청 프로세스 게시판 | `/governance/process/usage` |
| 5 | 신청서 인덱스 + 내 문서 목록 | `/governance/forms` |
| 7 | 게시글 작성 폼 | `/governance/{board}/new` |
| 8 | (5와 통합) 내 문서 목록 | `/governance/forms` |
| 9 | 신청서 read-only 상세 | `/governance/forms/detail/{id}` |
| 10 | 신청서 작성 폼 (5종 공통) | `/governance/forms/{type}/new` |
| 11 | 신청서 제출 완료 | `/governance/forms/submitted` |
| 12 | 글쓰기 권한 없음 | `/governance/{board}/forbidden` |

## API 요약

| Method | Path | 설명 |
|---|---|---|
| GET | `/me` | 현재 사용자 + 권한 비트맵 |
| GET | `/boards/{board_type}/posts` | 게시판 글 목록 |
| POST | `/boards/{board_type}/posts` | 게시글 작성 (권한 필요) |
| GET | `/boards/{board_type}/posts/{id}` | 상세 |
| PATCH/DELETE | `/boards/{board_type}/posts/{id}` | 작성자/admin |
| GET | `/forms?mine=true` | 내 신청서 목록 |
| POST | `/forms` | 신청서 제출 |
| GET | `/forms/{id}` | 상세 |
| PATCH | `/forms/{id}` | 수정 |
| GET | `/forms/{id}/export` | Excel 다운로드 |

`board_type` ∈ `policy / production_process / usage_process`
`form_type` ∈ `data_production / data_purchase / data_subscription / product_log_usage / data_production_plan`

## 다음 단계 후보

- 파일 첨부 업로드 실제 구현 (현재 UI 만)
- 신청서 수정 화면을 작성 폼과 통합 (현재 새로 작성만)
- 게시글 수정/삭제 UI
- 검색/필터/페이지네이션
- 실제 OAuth 인증 (현재 X-User-Email 헤더 가장)
