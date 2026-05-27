# 거버넌스 시스템 개발 정리

> 인턴 강민정 / Phase 1 UI/UX 작업
> GitHub Claude (개발) ↔ 사내 GitLab (배포)

---

## 1. 개발 환경 / 워크플로우

- **두 저장소 동기화**: GitHub Claude (`~/Documents/github/datahub_project_claude/datahub-develop/`) ↔ 사내 GitLab clone (`~/documents/project/datahub/`)
- **흐름**: GitHub Claude commit → `cp` 동기화 → 사내 feature 브랜치 → MR → develop 머지 → CI/CD 자동 배포 (`dev.datahub.lgair-data.com`)
- **브랜치 정책**: `develop` 직접 push 금지, feature 브랜치 + MR 패턴 정착
- **커밋 규약**: Conventional Commits (`feat:` / `fix:` / `refactor:` 등)

---

## 2. 사이드바 / 네비게이션

### 그룹 재구성

| 그룹 | 메뉴 |
|------|------|
| (단독) | 나의 현황 |
| **요청** | 데이터 용역 제작 / 데이터 구매 / 데이터 구독 |
| **조회** | 거버넌스 요청 목록 |
| 가이드 | 프로세스 안내 / 거버넌스 정책 |
| 관리 | 거버넌스 요청 관리 / 프로세스 관리 / 거버넌스 정책 관리 / 신청서 양식 카탈로그 / 통계·리포트 |

- 요청·조회 그룹명 변경 (신청서 → 요청, 통합 검색 → 조회)
- 요청을 조회 위로 재배치
- 사이드바 링크: `/governance/forms/planning?type=X` → `/governance/forms/intake?type=X` (계획 수립 substep 우회)

### `SectionNav` active 매칭 개선

- pathname 외 query string 도 비교 → 같은 path 의 query 메뉴(`?manage=1`) 와 일반 메뉴 구분
- 게시판 가이드 vs 관리 분리에 핵심

---

## 3. 신청서 작성 화면 (용역 제작 / 데이터 구매 / 데이터 구독)

### 표 레이아웃 통일

- 신청자 정보 / 조직장 사전 승인 / 요청 정보 / Compliance / 기타 모든 섹션을 **표 형태**로 통일
- 라벨 칸 240px 회색 + 입력 칸 1fr 흰색
- 행 사이 구분선, 마지막 행만 구분선 없음
- 신청자 정보는 별도 카드 → 표 행으로 변환

### 입력 단순화

- 긴 placeholder → 짧은 핵심 단어 (예: "데이터셋이 활용되는 프로젝트명을 기재해 주세요" → "프로젝트명")
- 라벨 축약 (예: "관련 프로젝트 (PMS 기준)" → "관련 프로젝트")
- `inlineWithNext` — 수량+단위 한 행 배치
- date 입력 max-width 200px
- textarea `rows` 차등화 (rows=2 → min-h 64px, rows=3 → 90px)

### 신규 schema 속성

- `FieldDef.rows?: number` (textarea 행 수)
- `FieldDef.tableLabel?: string` (표 라벨 override — 긴 안내문 checkbox 용)
- `SectionDef.layout?: "default" | "table"`

### 제출 전 검토 모달 (`PreSubmitPreviewModal`)

- 세 유형 모두 schema 의 전체 데이터 필드 자동 노출
- checkbox 액션성 항목만 제외

### 작성 → 제출 흐름

- 신청서는 전자결재 안내 문구 제거
- 데이터 구독은 계획 수립 + 신청서만 (중간 과정 제거)
- 제출 시 모든 신청 유형이 거버넌스 요청 목록으로 이동

---

## 4. 우측 채팅 패널 (`ChatPanel`) — 신청서 작성 + 상세 양쪽

### 구조

- 좌(1fr) 본문 + 우(300px) 채팅 2단 grid
- 채팅 내부 3단 flex column: 헤더 / 메시지 영역 / 입력창
- `flex-shrink-0` (헤더·입력창) + `min-h-0 flex-1 overflow-y-auto` (메시지 영역)
- 메시지 많아도 헤더·입력창 항상 보임

### 두 가지 높이 모드

- **신청서 작성**: 고정 `h-[calc(100vh-104px)] max-h-[560px]` + sticky `top-20` (상단 네비 64px + 16px 여백)
- **상세 페이지**: `fillParent` prop → `h-full` + 부모 grid `items-stretch` → 좌측 본문 높이에 맞춤

### 카톡 스타일 말풍선

- 본인(currentUserEmail 매칭): 우측 파랑 (`bg-blue-50` 또는 brand `bg-[#FCEAE5]`), 꼬리 우상단
- 담당자: 좌측 회색 + 아바타 + 이름, 꼬리 좌상단
- `accent` prop (blue / brand) 으로 색상 톤 전환

### 단계 구분선

- 메시지 사이 `stageAtSent` 가 달라지는 지점에 `── 신청 단계 ──` 구분선
- 현재 단계는 `#D4533E` 빨강 + "현재" 꼬리표
- `stageAtSent` 는 sessionStorage map (`dh:gov:chat-stages:{formId}`) 영속

### 자동 draft 생성

- `ApplicationFormContainer.persist` 반환 타입 `boolean → string|null` 확장
- 메시지 전송 시 formId 없으면 `ensureFormId` 콜백으로 draft 자동 생성 후 전송 → 임시저장 없이도 채팅 가능

### Window focus 자동 갱신

- 담당자 답장 폴링 대용으로 `focus` 이벤트 재조회

---

## 5. 거버넌스 요청 상세 페이지 (용역 제작)

### 레이아웃 (위 → 아래)

```
헤더: 제목 + REQ 번호 + 미리보기 버튼
── 풀 너비 ──
ProgressBar (5단계 막대)
HistoryTimeline (가로 진행 이력)
── 2단 grid (items-stretch) ──
좌(1fr)                              | 우(300px)
신청 정보 표 ("신청 정보" 헤더)        | ChatPanel
ApplicationStageTab (관리 진입만)      |   (fillParent — 좌측 높이 매칭)
첨부파일 (AttachmentSection)          |
[요청 목록으로] / [수정] 버튼          |
```

### `ProgressBar` — 막대 채우기형

- 5단계: 신청 / 협의 / 계약 / 진행 / 종료
- 막대 두께 9px, gap 5px, border-radius 5px
- 라벨 14px (가독성 ↑)
- 색: 완료 `#1D9E75` / 현재 `#D4533E` + weight 500 / 예정 회색
- `onStageClick` 전달 시 라벨이 버튼으로 변해 단계 자유 이동 (Phase 1 개발 편의)
- 5단계 상태는 sessionStorage 영속 (`dh:gov:service-stage:{formId}`)
- status `approved` 면 4(종료) 강제

### `HistoryTimeline` — 가로 진행 이력

- 카드 헤더: 시계 아이콘 + "진행 이력" + 건수 배지
- 원형 노드 15px + 가로 1px 연결선
- 마지막(최신) 노드만 채워진 원, 그 외는 테두리만
- 노드 아래: 이벤트 아이콘+라벨 / 시간(M/d HH:mm) / 작성자
- 이벤트 4건 이상 → 가로 스크롤 (`min-width: 560px`)

| 이벤트 | 매핑 조건 | 색 | 아이콘 |
|--------|----------|-----|--------|
| 신청서 제출 | `status="submitted"` | `#378ADD` | Send |
| 담당자 지정 | `status="reviewing"` or `action="review_started"` | `#993C1D` | UserCheck |
| 신청서 수정 | `status="submitted"` + comment "임시 저장" | `#BA7517` | Pencil |
| 보완 요청 | `status="info_requested"` | `#E08027` | Pencil |
| 승인 완료 | `status="approved"` | `#1D9E75` | CircleCheck |

- `approvalHistoryToEvents` 헬퍼: camelCase/snake_case 양쪽 표기 모두 fallback

### 신청 정보 표

- "신청 정보" 빨간 막대 헤더 추가
- Row 컴포넌트: 라벨 칸 170px, 패딩 균일 (px-4 py-3), `align-middle`
- 글자: 라벨 `text-[12px] gray-500`, 값 `text-[12px] gray-900`
- 조직장 승인 label override → "조직장 승인" (긴 안내문 축약)
- 조직장 승인 값: ✅ 이모지 → `<CheckCircle2>` 아이콘 + `#0F6E56` 녹색

### `AttachmentSection`

- 헤더: 빨간 막대 + "첨부파일" + 개수 배지 + 우측 [파일 업로드] 버튼
- 업로드 → 숨겨진 file input 트리거 → 칩 추가
- 타입별 아이콘 + 색:
  - PDF (`FileText` + `#A32D2D`) / Excel·CSV (`FileSpreadsheet` + `#3B6D11`)
  - Word (`FileText` + `#185FA5`) / 이미지 (`Image` + `#7C3AED`) / 기타 (`File` + 회색)
- 칩: 아이콘 · 파일명 · 용량 · 다운로드 · X(제거)
- 빈 상태: "첨부된 파일이 없습니다"
- 제한: 20MB, .pdf/.docx/.xlsx/.csv/.png/.jpg/.gif/.webp/.svg
- Phase 1: sessionStorage + ObjectURL mock (`uploadFormAttachment` API 미구현)
- 백엔드 첨부파일(`form.attachments`) 과 함께 노출

### 진입 컨텍스트별 노출 차이

| from | ProgressBar | HistoryTimeline | 신청 정보 | AttachmentSection | ApplicationStageTab | ChatPanel | 미리보기 |
|------|------------|-----------------|----------|-------------------|---------------------|-----------|----------|
| `admin` | ✓ | ✓ | ✓ | ✓ | ✓ (담당자 지정 + 검토) | ✓ | ✓ |
| `list` | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✗ (숨김) |
| `my` / 기본 | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |

---

## 6. 거버넌스 요청 관리 — `ApplicationStageTab`

### 신청 단계 내부 sub-step

```
member_assignment → under_review ⇄ revision_requested → approved
```

| sub-step | 액션 / UI |
|----------|----------|
| `member_assignment` | 담당자 칩 + [실무자 추가] + [검토 요청] 버튼 |
| `under_review` | 담당자 = [보완 요청] / [승인 · 협의 단계로] · 신청자 = "검토 중" 안내 |
| `revision_requested` | 담당자 = [검토 재시작] · 신청자 = "보완 요청 받음" 주황 안내 |
| `approved` | "신청 단계 승인 완료" ✓ (실제론 serviceStage 1+ 로 advance 됨) |

### 담당자 칩

- 총괄(`FIXED_ASSIGNEE` 김은솔) — 항상 표시, 제거 불가, `총괄` 배지
- 실무자들 — 제거 가능 (X 버튼)
- 본인 칩에 "나" 배지

### 실무자 추가 모달

- 이름 / 이메일 input 한 화면
- 자동 포커스 (이름)
- Enter 로 즉시 추가 (한글 IME 조합 중 Enter 무시)
- Esc / X / 취소 / 외부 클릭으로 닫기
- 인라인 에러 (빈 입력 / 중복 이메일)
- 다크모드 + 접근성 (`role="dialog"`, `aria-modal`)

### 역할 식별 (Phase 1)

- `isLead` = meEmail === FIXED_ASSIGNEE.email
- `isMember` = meEmail in members[]
- `isApplicant` = meEmail === submitterEmail
- Phase 1 개발 편의 — 버튼 disabled / 가시성 가드 모두 해제

### 데이터 영속 (Phase 1)

- 실무자 목록: `dh:gov:stage1:members:{formId}`
- sub-step: `dh:gov:stage1:substep:{formId}`
- 5단계 진행: `dh:gov:service-stage:{formId}`
- 채팅 stageAtSent: `dh:gov:chat-stages:{formId}`

### 거버넌스 요청 관리 목록 페이지

- 모든 로그인 사용자 접근 가능 (admin 가드 제거)
- 상태 필터 탭 + 신청 종류 select + 검색 + CSV 다운로드
- 행 클릭 → `/governance/forms/detail/{id}?from=admin`

---

## 7. 게시판 (정책 / 프로세스)

### 가이드 vs 관리 컨텍스트

- URL: `?manage=1` 으로 관리 모드 식별
- 진입 차이:
  - 관리: 상단고정 / 수정 / 삭제 버튼 + 작성하기 버튼 노출
  - 가이드: read-only

### `?manage=1` 단일 컨벤션 통일

- 이전: list 페이지 `?manage=1`, detail/new `?from=manage` → 사이드바 active 매칭 깨짐
- 통일 후: 모든 URL `?manage=1`

### 권한 가드 해제

- 모든 로그인 사용자에게 관리 그룹 개방
- platform role=admin 조건 → `viewAsAdmin` prop 으로 컨텍스트 기반 분기
- 게시글 작성: `POST /api/governance/posts` 백엔드도 admin 가드 해제 (사내 정책)
- `PostNewView`: 비-admin 을 forbidden 페이지로 튕기던 useEffect 제거

### Route 안전 장치

- `process/[id]/page.tsx` 가 `id === "new"` 일 때 `PostNewView` 직접 렌더 → 정적 `new/page.tsx` 누락 환경 방어
- policy 도 동일

---

## 8. 전역 입력 스타일 (`globals.css`)

### Date Input

- 달력 picker 아이콘 → 왼쪽 정렬 (`padding-left: 2rem !important`)
- 호버 시 아이콘 진해짐 (opacity 0.45 → 1)
- `required + :invalid` 상태에서 "연도. 월. 일." 텍스트 `gray-400`

### Number Input

- 브라우저 기본 spinner 화살표 제거 (`-moz-appearance: textfield` + webkit pseudo)
- 사용자 직접 숫자 입력 — 거버넌스 양식 정확성 ↑

### `DateField` 컴포넌트

- `required` 기본 true → `:invalid` 셀렉터로 placeholder 색 처리
- 거버넌스 신청서 전반 사용

---

## 9. 목록 페이지 4종 에러 노출

### 변경

- 기존 `.catch(() => setItems([]))` → 빨간 에러 박스 노출
- 401 / 네트워크 / DB 비었음 즉시 구분 가능

### 적용

- `BoardListView` (정책/프로세스)
- `PolicyBoardView` (정책 전용)
- `forms/list/page.tsx` (거버넌스 요청 목록)
- `admin/forms/page.tsx` (거버넌스 요청 관리)

---

## 10. Mock 데이터 (`prisma/seed.ts`)

### 신청서 8건 (REQ-2026-00002 ~ 00009)

- 6명 사용자 (박유진 / 이민수 / 최소연 / 김도윤 / 한재현 / 정혜원)
- 상태 다양: submitted / reviewing / info_requested / approved
- 신청 유형 다양: data_purchase / data_subscription / data_production / product_log_usage

### 변경

- `create` → `upsert` (재시드 시 mock 데이터 갱신 가능)
- `info_requested` 상태일 때 history 자동 생성 (`[보완 요청]` 접두 포함)

---

## 11. API Client 듀얼 셰이프 (`api-client-full.ts`)

### 배경

사내 dev 환경 strict TS 빌드에서 76 개 에러 — 백엔드는 camelCase, 옛 datahub-web 컴포넌트는 snake_case 사용

### 해결

- 어댑터 함수 (`adaptForm`, `adaptMessage`, `adaptPost`) — 백엔드 응답을 camelCase + snake_case 양쪽 shape 으로 변환
- `FormDetail` / `FormListItem` / `ApprovalEntry` 등 주요 타입에 양쪽 표기 모두 노출
- 신규 코드 camelCase 권장, 옛 컴포넌트 snake_case 호환

---

## 12. 컴포넌트 산출물 정리

### 신규 추가

```
components/governance/
├── ProgressBar.tsx                  ★ 5단계 막대 + sessionStorage 헬퍼
├── HistoryTimeline.tsx              ★ 가로 진행 이력 + 매핑 헬퍼
├── AttachmentSection.tsx            ★ 첨부파일 업로드/칩
├── stages/
│   └── ApplicationStageTab.tsx      ★ 담당자 지정 + 검토 액션 (관리 진입만)
└── chat/
    ├── ChatPanel.tsx                ★ 카톡 스타일, 단계 구분선, fillParent
    └── ChatMessageBubble.tsx        ★ 좌우 분기 + accent 색

lib/governance/
└── chat-assignee.ts                 ★ 담당자 결정 (FIXED_ASSIGNEE 재사용)
```

### 기존 컴포넌트 수정

```
ApplicationForm/
├── ApplicationFormContainer.tsx     (draft 2-col 레이아웃 + ChatPanel + 자동 draft 저장 + persist 반환 boolean→string|null)
├── ApplicationFormSection.tsx       (표 layout + tableLabel + inlineWithNext + textarea rows)
└── PreSubmitPreviewModal.tsx        (세 유형 모두 전체 필드 노출)

PostDetailView.tsx / PolicyDetailView.tsx    (관리/가이드 컨텍스트 분리)
BoardListView.tsx / PolicyBoardView.tsx      (?manage=1 통일, 작성하기 버튼 모든 사용자 노출)
FormStatusPanel.tsx                          (viewAsAdmin prop 추가)
ProcessStepper.tsx                           (substep 1 개뿐이면 컨테이너 숨김)
storyboard/section-nav.tsx                   (query 매칭 isActive)
```

### 데이터 / 스키마

```
lib/governance/forms/
├── schemas.ts                       (3 폼 표 layout + 단축 placeholder + rows + tableLabel)
└── phase1-substeps.ts               (planning substep 제거)

prisma/seed.ts                       (mock 8건 + upsert + info_requested history)
```

### 라우트

```
app/(dashboard)/governance/
├── layout.tsx                       (사이드바 그룹 재구성 + intake 진입 URL)
├── forms/
│   ├── detail/[id]/page.tsx         ★ 상세 페이지 전체 통합
│   └── list/page.tsx                (에러 노출)
├── admin/forms/page.tsx             (admin 가드 해제 + 에러 노출)
├── process/[id]/page.tsx            (id="new" 가드)
└── policy/[id]/page.tsx             (id="new" 가드)
```

### 전역

```
app/globals.css                      (date 아이콘 왼쪽 / number spinner 제거)
```

---

## 13. 데이터 영속 (Phase 1 sessionStorage 키)

| 키 | 용도 |
|----|------|
| `dh:gov:service-stage:{formId}` | 5단계 현재 인덱스 |
| `dh:gov:stage1:substep:{formId}` | 신청 단계 내부 sub-step |
| `dh:gov:stage1:members:{formId}` | 실무 담당자 목록 mock |
| `dh:gov:chat-stages:{formId}` | 메시지별 stageAtSent map |
| `dh:gov:attachments:{formId}` | mock 첨부파일 메타데이터 |
| `datahub:planningType` | 마지막 선택한 신청 유형 |
| `datahub:lastFormId:{type}` | 유형별 마지막 신청 id |

---

## 14. Phase 2 (백엔드 작업) 예정 항목

| 영역 | 작업 |
|------|------|
| Prisma 스키마 | `GovernanceForm.serviceStage` / `subStep` 컬럼 |
| Prisma 관계 | `GovernanceFormMember` (실무 담당자) |
| Prisma 컬럼 | `GovernanceFormMessage.stageAtSent` |
| API | `POST /api/governance/forms/{id}/attachments` (GCS 업로드 — 현재 placeholder) |
| API | `GET /api/users?search=` (사용자 검색) |
| API | `PATCH /api/governance/forms/{id}/assignees` (담당자 지정) |
| 알림 | 단계 전환 / 메시지 / 담당자 지정 트리거 |
| 권한 | 역할 기반 가드 복원 (`viewAsAdmin` 패턴 활용) |
| 실시간 | WebSocket / SSE 채팅 |
| 시드 | dev 자동 실행 Helm job |

---

## 15. 주요 버그 해결 기록 (참고)

| 증상 | 해결 |
|------|------|
| URL `?type=purchase?type=purchase` 이중 query | `PlanningFooter` 의 query 부착 중복 제거 |
| 76 개 TS 빌드 에러 | api-client 듀얼 셰이프 어댑터 도입 |
| sticky 채팅 헤더가 네비바에 가려짐 | sticky top `t-6 → t-20` (80px) + `calc(100vh - 104px)` |
| 진행 이력 0건 표시 | `approvalHistoryToEvents` snake_case fallback (`changed_at` / `changed_by`) |
| 사이드바 active "안내" 만 활성 | `SectionNav.isActive` 에 query 비교 추가 |
| `forEach` vs `for-of` 빌드 실패 | TS target es5 호환 — `forEach((v, k) => ...)` 로 교체 |
| 단계 자동 전환 (제출 → 협의) | sessionStorage 기반 수동 전환으로 변경 |
| `?from=manage` / `?manage=1` 혼용 | 모든 곳 `?manage=1` 로 통일 |
| 401 Unauthorized | 진단 절차 (재로그인 / 쿠키 확인) 안내 |
| 빌드 에러 (Check / UserPlus / ChevronUp import 누락) | lucide-react import 정리 |
