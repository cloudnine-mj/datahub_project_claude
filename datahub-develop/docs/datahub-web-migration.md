# datahub-web → datahub-develop 포팅 가이드

`datahub-web/` (FastAPI + Next.js 프로토타입) 의 게시판·신청서·진행이력 채팅 기능을
`datahub-develop/` (Next.js BFF + Prisma + PostgreSQL) 로 옮기는 작업.

## 원본 vs 타겟

| 영역 | datahub-web (원본) | datahub-develop (타겟) |
|---|---|---|
| 백엔드 | FastAPI Python | Next.js Route Handler (BFF) |
| DB | SQLite + SQLAlchemy | PostgreSQL + Prisma |
| 인증 | `X-User-Email` mock | `platform_token` 쿠키 (datahub-api) |
| 권한 | 본인/admin 단순 비교 | `getSession()` + `getDbUser()` + `startAudit()` |
| 파일 업로드 | 로컬 디스크 (`uploads/`) | Phase 1: 로컬 디스크 / Phase 2: GCS bucket |
| 라우트 보호 | 없음 | `(auth)` / `(dashboard)` route group + middleware |

## 모델 매핑

| datahub-web | datahub-develop (이 PR) | 비고 |
|---|---|---|
| `User` | `User` (기존) | 신규 row 가 필요하면 `getDbUser()` 가 upsert |
| `Post` | `GovernancePost` | 정책 + 프로세스 게시판 통합. `Governance` prefix |
| `PostAttachment` | `GovernancePostAttachment` | |
| `Form` | `GovernanceForm` | 신청서 7종 |
| `FormAttachment` | `GovernanceFormAttachment` | |
| `FormComment` | `GovernanceFormComment` | HuggingFace Discussion 형태 댓글 |
| `FormMessage` | `GovernanceFormMessage` | 진행 이력 양방향 채팅 |
| `FormMessageAttachment` | `GovernanceFormMessageAttachment` | |

타입 차이:
- 모든 PK 가 `int` → `cuid()` 문자열로 변경 (datahub-develop 컨벤션)
- snake_case → camelCase (Prisma 컨벤션)
- SQLAlchemy `JSON` → Prisma `Json` / `Jsonb`

## API 라우트 매핑

| datahub-web | datahub-develop |
|---|---|
| `GET  /forms` | `GET  /api/governance/forms` |
| `POST /forms` | `POST /api/governance/forms` |
| `GET  /forms/{id}` | `GET  /api/governance/forms/[id]` |
| `PATCH /forms/{id}` | `PATCH /api/governance/forms/[id]` |
| `DELETE /forms/{id}` | `DELETE /api/governance/forms/[id]` |
| `PATCH /forms/{id}/status` | `PATCH /api/governance/forms/[id]/status` |
| `GET /forms/{id}/export` | `GET /api/governance/forms/[id]/export` |
| 첨부 4종 | `/api/governance/forms/[id]/attachments` + `[aid]` |
| 댓글 3종 | `/api/governance/forms/[id]/comments` + `[cid]` |
| 메시지 4종 | `/api/governance/forms/[id]/messages` + `[mid]/attachments` |
| `GET /boards/{board}/posts` | `GET /api/governance/posts?board=...` |
| 정책 메타 + 첨부 | `/api/governance/posts/...` |

## 페이지 매핑

| datahub-web | datahub-develop |
|---|---|
| `/governance/forms/list` | `(dashboard)/governance/forms/list` |
| `/governance/forms/my` | `(dashboard)/governance/forms/my` |
| `/governance/forms/admin` | `(dashboard)/governance/forms/admin` (또는 통합) |
| `/governance/forms/detail/[id]` | `(dashboard)/governance/forms/[id]` |
| `/governance/forms/intake/*` | `(dashboard)/governance/forms/intake/*` |
| `/governance/forms/{type}/new` | `(dashboard)/governance/forms/[type]/new` |
| `/governance/process` | `(dashboard)/governance/process` |
| `/governance/policy` | `(dashboard)/governance/policy` |

기존 datahub-develop `/governance/page.tsx` (storyboard mock) 은 `/governance/forms/list` 로 리다이렉트 또는 실데이터 기반으로 교체.

## 인증/권한 변환 규칙

datahub-web 의 `_check_form_owner(form, user)` 패턴은 다음으로 치환:
```ts
const session = await getSession();
if (!session) return audit.fail(401, "Unauthorized");
const dbUser = await getDbUser(session);
if (!dbUser) return audit.fail(404, "User not found");
const form = await prisma.governanceForm.findUnique({ where: { id } });
if (!form) return audit.fail(404, "form not found");
const isAdmin = session.user.role === "ADMIN";
if (form.submitterId !== dbUser.id && !isAdmin) {
  return audit.fail(403, "권한이 없습니다.");
}
```

채팅 역할 판정 (`FIXED_ASSIGNEE` 김은솔) 는 env 로 옮김:
```
GOVERNANCE_ASSIGNEE_EMAIL=kim.eunsol@company.com
GOVERNANCE_ASSIGNEE_NAME=김은솔
```

## 작업 진행 상황

- [x] **Phase 1** — Prisma schema 추가 + migration SQL + 본 문서
- [x] **Phase 2** — 핵심 API routes (forms CRUD / posts CRUD / messages CRUD)
  - 보류: 첨부 파일 endpoint, status PATCH, pin toggle, Excel export, comments
  - 보류 사유: 첨부는 GCS bucket 통합 필요 (CLAUDE.md Phase 1 Type-B). 나머지는 단순 이전.
- [x] **Phase 3 partial** — lib 이전 + BFF api client + `/governance/forms/list` 데모 페이지
  - 이전 완료 lib: schemas, application-config, planning-config, determine-reply-target,
    history-adapter, validation, application-types, application-type-meta, role-mapping,
    phase1-substeps, preview, types
  - api-client.ts (governanceApi) 추가
  - .env.example 에 `GOVERNANCE_ASSIGNEE_EMAIL/_NAME` 추가
  - layout.tsx 에 "신청서 목록" 메뉴 추가
- [~] **Phase 4 partial** — 채팅 흐름 + 게시판 흐름 이전 완료
  - ProgressHistoryBlock + getChatRole + `(dashboard)/governance/forms/[id]` (채팅)
  - BoardList + PostDetail + `(dashboard)/governance/policy/*` + `/process/*` (게시판)
  - history-adapter 가 snake_case/camelCase 둘 다 처리
  - seed: 김은솔 user + 샘플 form + 데모 메시지 + 게시판 3건
  - layout.tsx 에 정책/프로세스 nav 항목 추가
  - **남은 페이지** (다음 세션):
    - `/governance/forms/intake/planning|build|load|approval` (다단계 인테이크)
    - `/governance/forms/[type]/new` (FormBuilder 7종)
    - `/governance/{policy,process}/new` (admin 작성)
    - `/governance/forms/my`, `/governance/forms/admin` (필터 변형 — list 페이지 재사용 가능)
  - **남은 컴포넌트**: ApplicationFormContainer, FormBuilder, phase-build/*, api-planning/*,
    ProcessStepper, PostNewView (admin 작성 폼), FormStatusPanel, FormProcessBar
- [ ] **Phase 5** — 첨부 파일 endpoint + GCS bucket 통합
- [ ] **Phase 6** — Seed (sample form/post 데이터) + Playwright smoke test
- [ ] **Phase 7** — 빌드/린트 통과 + storyboard `/governance/page.tsx` 를 forms list 로 리다이렉트

## 사내 GitLab 푸시 절차

이 working repo (`cloudnine-mj/datahub_project_claude`) 에서 작업물을 받아 사내 GitLab 으로 푸시:

```bash
# 1) 로컬에서 이 branch 의 최신 변경 받기
git pull origin claude/analyze-github-repo-fvDXq

# 2) 사내 GitLab remote 추가 (한 번만)
git remote add internal <gitlab-internal-url>

# 3) feature branch 로 분리
git checkout -b feat/governance-forms-port

# 4) datahub-develop/ 만 사내 GitLab 으로 push
#    (이 working repo 의 datahub-develop/ 가 사내 repo 의 root 와 같은 구조)
#    필요시 subtree split 으로 분리:
git subtree split --prefix=datahub-develop -b governance-port-only
git push internal governance-port-only:feat/governance-forms-port

# 5) GitLab UI 에서 develop 브랜치로 MR 생성 (Conventional Commit 제목)
```
