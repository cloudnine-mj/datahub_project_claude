# DataHub 웹 포털 (datahub)

Data Governance 웹 포털. 데이터 카탈로그 · 레포 · 버전 · 승인 워크플로우 · 챗봇 UX 를 제공하며, 모든 백엔드 호출은 [`datahub-api`](https://gitlab.lgresearch.ai/data-governance-public/datahub-api) 를 거친다.

## 주요 담당

| 담당자 | 역할 | 커밋 user.name |
|--------|------|---------------|
| 라온 (Raon)   | 프론트엔드 / UX       | `Raon (datahub-frontend)` |
| 하린 (Harin)  | 테스터·QA (고객 페르소나) | `Harin (datahub-tester)` |
| 도윤 (Doyun)  | IaC · 배포           | `Doyun (datahub-qa)` |

> 커밋 시: `git config user.name "Raon (datahub-frontend)"  # 본인 담당에 맞게 변경`

## 기능

- **홈/대시보드** (`src/app/(dashboard)/`) — 조직 데이터 자산 요약, 최근 활동
- **카탈로그** (`src/components/catalog/`) — Unity Catalog 메타데이터 탐색, 컬럼 lineage
- **레포 · 버전** (`src/components/repo/`, `version/`) — LakeFS 브랜치/커밋/태그 UX
- **승인 · 예산 · 계획** (`approvals/`, `budgets/`, `plans/`) — 데이터 접근 요청, 스토리지 예산, 로드맵
- **챗봇** (`src/components/chat/`) — LLM 기반 대화형 카탈로그 탐색
- **리포트** (`src/components/reports/`) — 조직 거버넌스 보고서

## 기술 스택

- **프레임워크**: Next.js 14 (App Router), React 18, TypeScript
- **스타일**: Tailwind CSS + Radix UI primitives + `class-variance-authority`
- **인증**: NextAuth (Google/MS SSO, Prisma adapter)
- **영속성**: PostgreSQL + Prisma (세션/설정만 저장 — 도메인 데이터는 `datahub-api` 경유)
- **배포**: Docker → GAR → Helm → GKE (3-stage: dev/stg/prd)

## 로컬 개발 환경 세팅

```bash
# 1) 의존성
npm install

# 2) .env 파일 생성 (.env.example 복사 후 값 채우기)
cp .env.example .env
#   필수 변수:
#     DATABASE_URL              Postgres (로컬 또는 dev 공유 DB)
#     NEXTAUTH_URL              http://localhost:3169
#     NEXTAUTH_SECRET           openssl rand -base64 32
#     GOOGLE_CLIENT_ID / SECRET Google OAuth 콘솔에서 발급
#     NEXT_PUBLIC_API_BASE_URL  https://api-dev.datahub.lgair-data.com  (또는 로컬 datahub-api)

# 3) Prisma 스키마 동기화
npm run db:generate
npm run db:migrate    # (최초 1회 / 스키마 변경 시)

# 4) 개발 서버 실행 (포트 3169)
npm run dev
```

접속: `http://localhost:3169`

## 빌드 & 린트

```bash
npm run build     # next build — .next/ 에 프로덕션 번들
npm run start     # next start — .next/ 번들 실행
npm run lint      # next lint (ESLint)
```

## 디렉토리 구조

```
src/
├── app/                  Next.js App Router (페이지 + 라우트 핸들러)
│   ├── (dashboard)/      대시보드 그룹 (레이아웃 공유)
│   ├── api/              라우트 핸들러 (NextAuth 엔드포인트 등)
│   └── fonts/
├── components/           도메인별 React 컴포넌트
│   ├── ui/               Radix 래핑 primitive (Button, Dialog, ...)
│   ├── catalog/  repo/  version/  approvals/  budgets/  chat/  ...
├── lib/                  공통 유틸 (datahub-api 클라이언트, auth helpers)
└── types/                공유 TypeScript 타입

prisma/                   Prisma schema + seed
public/                   정적 자산
```

## 배포

CI/CD 파이프라인(`.gitlab-ci.yml`)이 브랜치 기반으로 3-stage 클러스터에 자동 배포한다.

| 브랜치 | 클러스터 | 웹 도메인 |
|---|---|---|
| `develop` | `lgair-datahub-dev` | `dev.datahub.lgair-data.com` |
| `staging` | `lgair-datahub-stg` | `stg.datahub.lgair-data.com` |
| `main`    | `lgair-datahub-prd` | `datahub.lgair-data.com` |

상세 절차: [`deploy/README.md`](deploy/README.md). 신규 클러스터 부트스트랩(ingress-nginx / cert-manager)은 `datahub-api` 레포의 `deploy/cluster-bootstrap/` 을 공용으로 참조한다.

## 관련 레포

- **백엔드 API**: [`data-governance-public/datahub-api`](https://gitlab.lgresearch.ai/data-governance-public/datahub-api) — 이 포털이 호출하는 FastAPI 서비스
- **파이썬 SDK**: `lgair-datahub` (GitLab PyPI 레지스트리) — 같은 API 를 CLI/노트북에서 쓰는 thin client

## 개발 규약

- [`DEV_RULES.md`](DEV_RULES.md) — 커밋/브랜치/컴포넌트 규약
- [`DEV_STATUS.md`](DEV_STATUS.md) — 작업 진행 상태 기록
