# DG Management Portal — 모듈별 개발 현황

> **최종 업데이트:** 2026-02-24
> **기술 스택:** Next.js 14 / TypeScript / Prisma + PostgreSQL / NextAuth / Tailwind + Shadcn/ui

---

## 전체 요약

| 모듈 | 상태 | 완성도 | 비고 |
|------|------|--------|------|
| 인증 (Auth) | 기본 완성 | 85% | 회원가입 페이지 커밋 대기 |
| 대시보드 (Dashboard) | 기본 완성 | 80% | 통계 카드 + 최근 활동, 차트 미구현 |
| 기획서 (Plans) | 핵심 완성 | 90% | CRUD + 검색/필터 + 상태관리 완료 |
| 보고서 (Reports) | 핵심 완성 | 85% | CRUD 완료, 기획서 연결 완료 |
| 결재 (Approvals) | 핵심 완성 | 85% | 다단계 결재 엔진 구현 완료 |
| 데이터 카드 (Data Cards) | 기본 완성 | 80% | CRUD + 목록/필터 완료 |
| 예산 (Budgets) | 기본 구현 | 60% | 조회만 가능, CRUD/차트 미구현 |
| 조직 관리 (Organizations) | 완성 | 95% | Lab/TechCell CRUD 완료 |
| 프로젝트 관리 (Projects) | 완성 | 90% | CRUD + 검색/필터 완료 |
| 사용자 관리 (Users) | 기본 완성 | 80% | 역할 변경, 조직 배정 가능 |
| 시스템 설정 (Settings) | 기본 완성 | 70% | 결재 설정만 구현 |

---

## 1. 인증 모듈 (Auth)

### 파일 구조
```
src/app/(auth)/login/page.tsx
src/app/(auth)/signup/page.tsx          ← 커밋 대기 (수정됨)
src/app/api/auth/[...nextauth]/route.ts
src/app/api/auth/register/route.ts
src/app/api/public/organizations/route.ts  ← untracked
src/lib/auth.ts
```

### 구현 완료
- [x] Google OAuth 로그인
- [x] Credentials 로그인 (개발용)
- [x] JWT 세션 관리 (역할/조직 정보 포함)
- [x] 회원가입 페이지 (이름, 이메일, 조직 선택)
- [x] 회원가입 API (`/api/auth/register`)
- [x] 공개 조직 목록 API (`/api/public/organizations`)

### 미구현 / 개선 필요
- [ ] 비밀번호 해싱 (bcrypt 등) 확인 필요
- [ ] 이메일 중복 검증 UX
- [ ] 비밀번호 찾기/재설정
- [ ] middleware.ts 기반 라우트 보호 (현재 레이아웃 레벨에서만 체크)

### Git 상태
- `signup/page.tsx` — 수정됨 (unstaged)
- `api/public/` — untracked

---

## 2. 대시보드 (Dashboard)

### 파일 구조
```
src/app/(dashboard)/dashboard/page.tsx
```

### 구현 완료
- [x] 통계 카드 4종 (대기 결재, 내 기획서, 승인된 기획서, 분기 예산)
- [x] 최근 활동 목록 (기획서 기준, 최근 5건)
- [x] Plans / Approvals / Budgets API 통합 조회
- [x] 로딩 상태 처리

### 미구현 / 개선 필요
- [ ] Recharts 기반 시각화 차트 (budget-chart.tsx 컴포넌트 존재하나 대시보드 미연결)
- [ ] 보고서 관련 최근 활동 포함
- [ ] 빠른 링크 / 바로가기 위젯
- [ ] 역할별 차별화된 대시보드 뷰

---

## 3. 기획서 모듈 (Plans)

### 파일 구조
```
src/app/(dashboard)/plans/page.tsx           — 목록
src/app/(dashboard)/plans/new/page.tsx       — 생성
src/app/(dashboard)/plans/[id]/page.tsx      — 상세
src/app/(dashboard)/plans/[id]/edit/page.tsx — 수정
src/app/api/plans/route.ts                   ← 커밋 대기
src/app/api/plans/[id]/route.ts              ← 커밋 대기
src/components/plans/plan-form.tsx
src/components/plans/plan-detail.tsx
src/components/plans/plan-table.tsx
```

### 구현 완료
- [x] 목록 조회 + 페이지네이션 (`{data:[], pagination:{}}`)
- [x] 검색 (데이터명) + 상태 필터
- [x] 신규 생성 — 연도 → 프로젝트 → 분기 캐스케이딩 셀렉트
- [x] 상세 보기 (프로젝트, 작성자, 관리자, 데이터 정보 등)
- [x] 수정 (DRAFT 상태만)
- [x] 삭제 (DRAFT 상태만)
- [x] 상태 전이: DRAFT → SUBMITTED → APPROVED/REJECTED → IN_PROGRESS → COMPLETED

### 미구현 / 개선 필요
- [ ] 결재 요청 버튼 연동 (상세 페이지에서 직접 결재 제출)
- [ ] 첨부 파일 업로드
- [ ] 기획서 복제(복사) 기능

### Git 상태
- `api/plans/route.ts`, `api/plans/[id]/route.ts` — 수정됨 (unstaged)

---

## 4. 보고서 모듈 (Reports)

### 파일 구조
```
src/app/(dashboard)/reports/page.tsx
src/app/(dashboard)/reports/new/page.tsx
src/app/(dashboard)/reports/[id]/page.tsx
src/app/(dashboard)/reports/[id]/edit/page.tsx
src/app/api/reports/route.ts
src/app/api/reports/[id]/route.ts
src/components/reports/report-form.tsx
src/components/reports/report-detail.tsx
```

### 구현 완료
- [x] 목록 조회
- [x] 신규 생성 — 기획서 연결 (드롭다운)
- [x] 실 투입 비용, 데이터 건수/크기, 저장 위치 입력
- [x] 품질 관리자 배정
- [x] 상세 보기 + 수정 + 삭제
- [x] 결재 워크플로우 연동

### 미구현 / 개선 필요
- [ ] 보고서 상태 필터/검색
- [ ] 보고서 ↔ 기획서 비교 뷰 (계획 vs 실적)
- [ ] 추가 데이터 필요 시 후속 기획서 자동 생성 플로우

---

## 5. 결재 모듈 (Approvals)

### 파일 구조
```
src/app/(dashboard)/approvals/page.tsx
src/app/(dashboard)/approvals/[id]/page.tsx
src/app/api/approvals/route.ts
src/app/api/approvals/[id]/route.ts
src/lib/approval-engine.ts
src/components/approvals/approval-flow.tsx
src/components/approvals/approval-action.tsx
src/components/approvals/approval-history.tsx
```

### 구현 완료
- [x] 결재 엔진 (`approval-engine.ts`) — 다단계 결재 로직
- [x] 결재 요청 생성 (기획서/보고서)
- [x] 결재 단계별 처리 (승인/반려 + 코멘트)
- [x] 결재자 자동 결정 (PM_LEADER, TM_LEADER, LAB_LEADER, TECH_CELL_LEADER)
- [x] 결재 대기 목록 조회
- [x] 결재 상세 + 승인/반려 액션

### 미구현 / 개선 필요
- [ ] 결재 이력 타임라인 UI 고도화
- [ ] 이메일/알림 연동
- [ ] 결재 위임 기능
- [ ] 일괄 승인 기능

---

## 6. 데이터 카드 (Data Cards)

### 파일 구조
```
src/app/(dashboard)/data-cards/page.tsx
src/app/(dashboard)/data-cards/new/page.tsx
src/app/(dashboard)/data-cards/[id]/page.tsx
src/app/(dashboard)/data-cards/[id]/edit/page.tsx
src/app/api/data-cards/route.ts
src/app/api/data-cards/[id]/route.ts
src/components/data-cards/data-card-form.tsx
src/components/data-cards/data-catalog.tsx
```

### 구현 완료
- [x] 목록 조회 + 유형/범위 필터 + 검색
- [x] 신규 생성 (데이터명, 유형, 크기, 수량, 포맷, 저장 위치, 접근 범위, 태그)
- [x] 상세 보기 + 수정 + 삭제

### 미구현 / 개선 필요
- [ ] 기획서/보고서와 연결 (관계 설정)
- [ ] 태그 기반 카드 그룹핑/필터
- [ ] 데이터 카탈로그 통계 대시보드

---

## 7. 예산 모듈 (Budgets)

### 파일 구조
```
src/app/(dashboard)/budgets/page.tsx
src/app/api/budgets/route.ts
src/components/budgets/budget-overview.tsx   ← 미사용
src/components/budgets/budget-chart.tsx      ← 미사용
```

### 구현 완료
- [x] 예산 목록 조회 (프로젝트/랩/테크셀별)
- [x] 대상 유형 필터
- [x] 예산 대비 사용률 바 차트 (인라인)
- [x] API: GET (목록 조회)

### 미구현 / 개선 필요
- [ ] 예산 생성/수정/삭제 (현재 조회만 가능)
- [ ] budget-overview.tsx, budget-chart.tsx 컴포넌트 페이지 연결
- [ ] Recharts 기반 예산 시각화
- [ ] 분기별 예산 비교
- [ ] 기획서 비용과 예산 자동 연동 (CostRecord)

---

## 8. 조직 관리 (Organizations) — Admin

### 파일 구조
```
src/app/(dashboard)/admin/organizations/page.tsx
src/app/api/organizations/route.ts
src/app/api/organizations/[id]/route.ts
```

### 구현 완료
- [x] Lab CRUD (이름, 리더 배정)
- [x] TechCell CRUD (Lab 내 하위 조직)
- [x] 멤버 수 표시
- [x] 리더 선택 (사용자 드롭다운)
- [x] 삭제 시 하위 TechCell 연쇄 삭제

### 미구현 / 개선 필요
- [ ] 멤버 관리 (조직에 사용자 추가/제거) UI
- [ ] 조직도 시각화

---

## 9. 프로젝트 관리 (Projects) — Admin

### 파일 구조
```
src/app/(dashboard)/admin/projects/page.tsx
src/app/api/projects/route.ts
src/app/api/projects/[id]/route.ts
```

### 구현 완료
- [x] 프로젝트 CRUD
- [x] 검색 + 연도 필터 + 상태 필터
- [x] PM/TM 리더 배정
- [x] 예산, 기간, 상태 관리
- [x] 조직(Lab/TechCell) 연결
- [x] 135개 프로젝트 시드 데이터 로드

### 미구현 / 개선 필요
- [ ] 프로젝트 상세 페이지 (현재 목록에서만 관리)
- [ ] 프로젝트별 기획서/보고서 연결 뷰

---

## 10. 사용자 관리 (Users) — Admin

### 파일 구조
```
src/app/(dashboard)/admin/users/page.tsx   ← 커밋 대기
src/app/api/admin/users/route.ts
src/app/api/admin/roles/route.ts
```

### 구현 완료
- [x] 사용자 목록 조회 + 검색
- [x] 역할 변경 (ADMIN, MANAGER, USER)
- [x] 조직(Lab/TechCell) 배정
- [x] 역할 목록 API

### 미구현 / 개선 필요
- [ ] 사용자 비활성화/차단
- [ ] 마지막 로그인 일시 표시
- [ ] 벌크 역할 변경

### Git 상태
- `admin/users/page.tsx` — 수정됨 (unstaged)

---

## 11. 시스템 설정 (Settings) — Admin

### 파일 구조
```
src/app/(dashboard)/admin/settings/page.tsx
src/app/api/admin/settings/route.ts
```

### 구현 완료
- [x] 결재 유형별 설정 조회 (PROJECT, LAB, TECH_CELL, PROJECT_TECH_CELL)
- [x] 결재 단계 추가/삭제/수정
- [x] 활성/비활성 토글

### 미구현 / 개선 필요
- [ ] 설정 상세 수정 API (`/api/admin/settings/[id]` 라우트 미존재)
- [ ] 시스템 전반 설정 (사이트명, 공지사항 등)
- [ ] 감사 로그 (Audit Log)

---

## 공통 인프라

### DB 스키마 (Prisma)
```
prisma/schema.prisma    — 모델 12개, Enum 8개
prisma/seed.ts          — 시드 데이터
```

### 공통 라이브러리
| 파일 | 역할 | 상태 |
|------|------|------|
| `src/lib/auth.ts` | NextAuth 설정 (Google + Credentials) | 완성 |
| `src/lib/prisma.ts` | Prisma Client 싱글턴 | 완성 |
| `src/lib/utils.ts` | cn(), formatCurrency(), formatDate(), getQuarterLabel() | 완성 |
| `src/lib/approval-engine.ts` | 다단계 결재 엔진 | 완성 |
| `src/types/index.ts` | 전체 타입 정의 | 완성 |

### UI 컴포넌트 (Shadcn/ui) — 17개 설치 완료
button, input, label, card, dialog, select, checkbox, switch, table, tabs, avatar, badge, scroll-area, separator, dropdown-menu, tooltip, textarea

### 레이아웃 컴포넌트
| 파일 | 역할 | 상태 |
|------|------|------|
| `src/components/layout/sidebar.tsx` | 사이드바 (역할별 메뉴) | 완성 |
| `src/components/layout/header.tsx` | 상단 헤더 | 완성 |
| `src/components/layout/nav-items.tsx` | 네비게이션 항목 정의 | 완성 |

---

## 커밋 대기 변경사항

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(auth)/signup/page.tsx` | 회원가입 페이지 수정 |
| `src/app/(dashboard)/admin/users/page.tsx` | 사용자 관리 페이지 수정 |
| `src/app/api/plans/route.ts` | Plans API 개선 (+14/-4) |
| `src/app/api/plans/[id]/route.ts` | Plan 상세 API 개선 (+9/-1) |
| `src/app/api/public/` (new) | 공개 API (조직 목록) 추가 |

---

## 개발 로드맵 (우선순위)

### P0 — 즉시
1. 커밋 대기 변경사항 커밋
2. middleware.ts 라우트 보호 추가

### P1 — 단기
3. 예산 모듈 CRUD 완성
4. 결재 ↔ 기획서/보고서 상세 페이지 연동 강화
5. 설정 상세 수정 API (`/api/admin/settings/[id]`) 추가

### P2 — 중기
6. 대시보드 Recharts 차트 연동
7. 보고서 검색/필터 기능
8. 데이터 카드 ↔ 기획서/보고서 관계 설정
9. 파일 첨부 기능

### P3 — 장기
10. 이메일/알림 시스템
11. 감사 로그 (Audit Log)
12. 조직도 시각화
13. 결재 위임 / 일괄 승인
