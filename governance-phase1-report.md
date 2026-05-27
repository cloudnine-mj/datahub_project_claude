# 거버넌스 시스템 Phase 1 개발 정리

> 작성: 강민정 (인턴) / 거버넌스 시스템 UI/UX 작업

## 들어가며

지난 몇 주 동안 거버넌스 시스템의 신청서 작성·상세·관리 화면을 새로 다듬었습니다. 백엔드 스키마는 그대로 두고 프론트엔드 위주로 작업했고, 백엔드가 따라와야 할 부분은 Phase 2 로 분리해 두었습니다.

작업은 GitHub 의 claude 저장소에서 코드를 만들고, 사내 GitLab clone 에 동기화한 뒤 feature 브랜치 → MR → develop 머지 → 자동 배포(`dev.datahub.lgair-data.com`) 흐름으로 진행했습니다. 초반에 실수로 develop 에 직접 push 한 적이 있어서 revert MR 로 복구한 뒤로는 항상 feature 브랜치를 거치게 했습니다.

---

## 사이드바부터 정리

먼저 사이드바 그룹명과 순서를 다듬었습니다. "신청서" 라는 이름이 모호해 보여서 **"요청"** 으로, "통합 검색" 은 실제로 검색이 아니라 목록 조회라 **"조회"** 로 바꿨습니다. 사용자가 자주 들어가는 요청 그룹을 조회 위로 올려서 시선 흐름도 맞췄어요.

```
나의 현황 (단독)
요청    │ 데이터 용역 제작 / 데이터 구매 / 데이터 구독
조회    │ 거버넌스 요청 목록
가이드  │ 프로세스 안내 / 거버넌스 정책
관리    │ 거버넌스 요청 관리 / 프로세스 관리 / 거버넌스 정책 관리 /
        │ 신청서 양식 카탈로그 / 통계·리포트
```

여기서 부수적으로 발견한 버그가 하나 있었는데, 사이드바의 active 표시가 pathname 만 비교하다 보니 `/governance/process` 와 `/governance/process?manage=1` 가 같은 메뉴로 잡혀서 항상 "프로세스 안내" 만 활성화됐습니다. `SectionNav.isActive` 가 href 의 query 까지 같이 비교하도록 고쳐서 해결했습니다. 가이드 vs 관리 컨텍스트 분리에 핵심적인 동작이라 나중에도 계속 활용되고 있어요.

계획 수립 substep 은 사용자 시나리오상 굳이 거칠 필요가 없다는 결론이라 사이드바에서 곧바로 신청서 작성(`/governance/forms/intake?type=X`) 으로 가도록 바꿨고, `phase1-substeps.ts` 에서도 planning 항목을 빼서 상단 탭 바에도 안 보이게 했습니다.

---

## 신청서 작성 화면 (세 유형)

### 표 레이아웃 통일

세 신청서(용역 제작 / 구매 / 구독) 가 디자인이 제각각이라 라벨 240px 회색 + 입력 1fr 흰색의 **표 형태**로 모두 통일했습니다. 신청자 정보·조직장 사전 승인·요청 정보 등 모든 섹션이 같은 골격을 쓰게 됐어요. 행 사이엔 구분선, 마지막 행만 구분선이 없습니다.

스키마(`schemas.ts`) 에 두 가지 속성을 추가해서 표 렌더링을 지원했습니다:
- `SectionDef.layout: "default" | "table"` — 섹션 단위로 표 모드 적용
- `FieldDef.tableLabel?` — checkbox 처럼 본 label 이 긴 안내문이라 표 라벨로 쓰기엔 부적합한 경우 짧은 표 라벨을 따로 지정
- `FieldDef.rows?` — textarea 의 행 수 (rows=2 → min-h 64px, rows=3 → 90px) 로 입력칸 높이만 봐도 답변 길이를 가늠할 수 있게

### 안내문은 짧게

원래 placeholder 가 "데이터셋이 활용되는 프로젝트명을 기재해 주세요 (복수 기재 가능, PMS 기준)" 처럼 한 줄이 너무 길었습니다. 이건 작성 화면을 답답하게 만들었다고 판단해서 핵심 단어만 남겼습니다 — "프로젝트명". 라벨도 마찬가지로 "관련 프로젝트 (PMS 기준)" → "관련 프로젝트" 식으로 줄였어요.

대신 처음 보는 사용자가 헤맬 수 있어서 **[작성 예시]** 모달을 추가했습니다. 임시 저장 버튼 왼쪽에 두고, 클릭하면 ChatEXAONE 프롬프트 추천 고도화 케이스를 항목별 표로 보여줍니다 (12 행). 용역 제작에만 일단 붙였고, 다른 유형도 필요해지면 같은 패턴으로 늘릴 수 있게 만들었습니다.

### 제출 전 검토 모달

기존엔 service 유형만 모든 필드를 보여주고 purchase/subscribe 는 짧은 row 매핑을 썼는데, 일관성이 없어서 세 유형 모두 schema 의 데이터 필드를 자동으로 다 보여주도록 통일했습니다 (checkbox 같은 액션성 항목만 제외).

---

## 우측 채팅 패널

신청서 작성 화면이 항목이 많아 길어지다 보니, 작성 중간에 담당자(김은솔) 한테 빠르게 물어볼 수 있는 채널이 있으면 좋겠다는 요구가 있었습니다. 그래서 우측에 카톡 스타일 채팅 패널을 붙였습니다.

```
좌(1fr) 신청서 폼          │ 우(300px) 채팅 패널 (sticky)
```

채팅 자체는 기존 `/api/governance/forms/{id}/messages` 엔드포인트를 그대로 썼습니다. 다만 draft 상태에선 formId 가 아직 없을 수 있어서, 메시지 전송 시 formId 가 없으면 `ensureFormId` 콜백으로 draft 를 자동 생성하고 그 id 로 메시지를 보내도록 했습니다. 그러려고 `persist()` 의 반환 타입을 `boolean → string|null` 로 바꿨는데, 기존 호출부의 `if(ok)` 패턴은 truthy 체크라 그대로 동작해서 다른 데를 건드릴 필요는 없었습니다.

상세 페이지에선 같은 ChatPanel 컴포넌트를 재사용하지만, 작성 화면과 달리 sticky 가 아니라 좌측 본문 높이에 stretch 되어야 자연스러웠습니다. 그래서 `fillParent` prop 을 추가해 한 컴포넌트로 두 모드를 모두 지원합니다.

### sticky 위치 문제

상세 페이지에서 채팅 헤더가 자꾸 상단 글로벌 네비게이션 바에 가려졌습니다. 처음엔 `top-6` (24px) 으로 줬는데 네비 높이(h-16 = 64px) 보다 작아서 가려진 거였어요. `top-20` (80px = 64 + 16 여백) + 높이는 `calc(100vh - 104px)` (104 = 네비 64 + 위 16 + 아래 24) 로 조정해서 해결했습니다.

### 단계 구분선

채팅이 같은 신청서의 모든 단계에서 보이는 단일 채널이라, 어느 단계에서 쓴 메시지인지 시각적으로 구분이 필요했습니다. 메시지 사이에 `── 신청 단계 ──` 같은 구분선을 넣고, 현재 단계만 빨강 + "현재" 꼬리표로 강조했어요.

`stageAtSent` 같은 컬럼이 백엔드에 없어서 Phase 1 에선 sessionStorage map (`dh:gov:chat-stages:{formId}`) 으로 영속합니다. 새 메시지 전송 시 현재 단계를 map 에 기록하고, 렌더할 때 그 map 을 보고 구분선을 넣어요. Phase 2 에서 컬럼이 생기면 sessionStorage 부분만 교체하면 됩니다.

---

## 거버넌스 요청 상세 페이지 (용역 제작)

상세 페이지는 위→아래로 진행 상태 → 진행 이력 → 신청 정보 → 첨부 → 채팅 순으로 쌓이는 구조입니다.

### 5단계 ProgressBar

신청 / 협의 / 계약 / 진행 / 종료 5단계를 막대 채우기형으로 그렸습니다. 색은 완료 `#1D9E75` 녹색, 현재 `#D4533E` 빨강, 예정 회색이고요.

처음엔 막대 두께 8px, 라벨 11px 로 만들었는데 너무 흐려서 안 보인다는 피드백이 있었습니다. 막대 9px + 라벨 14px 로 키우고 예정 라벨 색도 tertiary → secondary 로 진하게 바꿔서 가독성을 올렸어요.

진행 상태가 자동으로 다음 단계로 넘어가던 버그가 있었는데, `status="submitted"` → 협의(1) 로 매핑하던 코드 때문이었습니다. 사용자 요구는 "제출만으로는 신청 단계(1/5) 에 머물고, 담당자가 검토·승인 버튼을 눌러야 협의로 넘어가야 한다" 였어요. status 매핑을 제거하고 sessionStorage 기반 수동 전환으로 바꿨습니다. 추가로 Phase 1 개발 편의를 위해 막대 라벨을 클릭하면 단계 자유 이동도 가능하게 만들었습니다 (`onStageClick`).

### 가로 진행 이력

진행 이력을 세로 타임라인으로 그릴까 가로로 그릴까 고민하다가, 단계가 5 개라 가로가 한눈에 들어와서 가로로 만들었습니다. 원형 노드 + 가로 연결선 + 노드 아래 아이콘·라벨·시간·작성자 순서로 쌓고, 이벤트 4건 이상이면 가로 스크롤되도록 `min-width: 560px` 처리.

이벤트 매핑은 백엔드 `approval_history` 의 status / action / comment 를 휴리스틱으로 해석합니다:
- `status="submitted"` + comment "임시 저장" → 신청서 수정 (주황)
- `status="submitted"` → 신청서 제출 (파랑)
- `status="reviewing"` 또는 `action="review_started"` → 담당자 지정 (갈색)
- `status="info_requested"` → 보완 요청 (주황)
- `status="approved"` → 승인 완료 (녹색, 노드 채움)

여기서 한참 헤맸던 버그가 있어요. `form.approval_history` 는 snake_case (`changed_at` / `changed_by`) 이고 `form.approvalHistory` 는 camelCase 인데, 함수가 camelCase 만 읽고 있었습니다. 그래서 모든 entry 가 `if (!h.changedAt) return;` 에서 early-return 되어 이벤트가 0건 → 카드 자체가 안 보이는 상태였어요. 양쪽 표기 모두 fallback 처리(`h.changedAt ?? h.changed_at`) 로 해결했습니다.

### 신청 정보 표

라벨 칸을 240px 에서 170px 로 줄여서 값 영역을 더 넓게 했습니다. 행 패딩을 균일하게(px-4 py-3) 하고 글자 크기도 통일했어요. 조직장 승인 값이 원래 `✅ 확인 완료` 이모지였는데 `<CheckCircle2>` 아이콘 + `#0F6E56` 녹색 텍스트로 바꿨고, 라벨도 긴 안내문 ("조직장 승인 완료 — 조직장 사전 승인을…") 대신 "조직장 승인" 으로 축약했습니다 (확인 화면 한정 override, 작성 화면의 schema label 은 그대로).

### 첨부파일 섹션

기존엔 단순한 목록(`<li>📎 파일명...`) 이었는데, 헤더에 빨간 막대 + 개수 배지 + 우측 [파일 업로드] 버튼을 두고 파일별 칩으로 다시 그렸습니다. 칩은 확장자별로 아이콘·색이 다르고 (PDF #A32D2D / Excel #3B6D11 / Word #185FA5 / 이미지 #7C3AED), 다운로드·X(제거) 버튼이 붙어 있어요.

업로드 API(`api.uploadFormAttachment`) 가 placeholder 상태라서 Phase 1 에선 sessionStorage + ObjectURL 로 mock 했습니다. 새 세션에서는 blobUrl 이 만료되니까 다운로드 버튼이 안 보이게 처리해뒀고요. Phase 2 에서 GCS 업로드 API 가 생기면 `onFileSelected` 의 sessionStorage 부분만 교체하면 됩니다.

### 진입 컨텍스트별 UI

상세 페이지는 어디서 들어왔느냐(`?from=admin` / `from=list` / `from=my` / 기본) 에 따라 노출이 달라집니다:

| 진입 | ApplicationStageTab | 미리보기 버튼 |
|------|---------------------|--------------|
| 거버넌스 요청 관리 (`admin`) | 노출 (담당자 지정 + 검토 액션) | 노출 |
| 거버넌스 요청 목록 (`list`) | 미노출 | 미노출 (조회 전용) |
| 내 문서 목록 (`my`) / 기본 | 미노출 | 노출 |

ProgressBar / HistoryTimeline / 신청 정보 표 / 첨부 / 채팅은 모든 컨텍스트에서 동일하게 노출합니다.

---

## 거버넌스 요청 관리 — 담당자 지정 + 검토 흐름

`ApplicationStageTab` 컴포넌트가 이 화면의 핵심입니다. 신청 단계 내부에 sub-step 을 두고 흐름을 명시했어요:

```
member_assignment → under_review ⇄ revision_requested → approved
```

| sub-step | 화면 |
|----------|------|
| `member_assignment` | 담당자 칩 + [실무자 추가] + [검토 요청] 버튼 |
| `under_review` | 담당자에겐 [보완 요청] / [승인 · 협의 단계로], 신청자에겐 "검토 중" 안내 |
| `revision_requested` | 담당자에겐 [검토 재시작], 신청자에겐 주황 "보완 요청 받음" 안내 |
| `approved` | "신청 단계 승인 완료" — 실제론 5단계 진행이 1+ 로 advance |

총괄 담당자는 `FIXED_ASSIGNEE` (김은솔) 를 그대로 쓰고, 실무 담당자는 칩 형태로 추가/제거합니다. 처음엔 [실무자 추가] 를 `window.prompt` 두 번(이름 → 이메일) 으로 만들었는데 UX 가 좋지 않아서 커스텀 모달로 바꿨어요. 이름·이메일 input 한 화면에서 Enter 로 즉시 추가, Esc 로 취소, 한글 IME 조합 중 Enter 는 무시하도록 했습니다.

역할 식별은 이메일 매칭으로 처리하지만, Phase 1 개발 편의를 위해 버튼 disabled / 가시성 가드는 모두 해제한 상태입니다 ("일단 다 풀어줘 — 개발하는 중이니까"). Phase 2 백엔드 권한 가드와 함께 다시 적용할 예정이에요.

거버넌스 요청 관리 목록 페이지(`/governance/admin/forms`) 도 platform role=admin 가드를 제거해서 모든 로그인 사용자가 접근할 수 있게 했습니다. 사내 정책 변경에 따른 처리이고, 실제 admin 액션 가드는 백엔드 라우트에 그대로 남아 있어요.

---

## 게시판 (정책 / 프로세스)

가이드 vs 관리 컨텍스트 구분이 가장 까다로웠던 부분 중 하나입니다. URL 컨벤션을 두 가지로 시작했다가(`?manage=1` / `?from=manage`) 사이드바 active 매칭이 깨지는 걸 발견해서 결국 `?manage=1` 로 통일했어요. 관리 모드 진입 시 상단고정 / 수정 / 삭제 / 작성하기 버튼이 노출되고, 가이드 모드는 read-only.

여기서도 사내 정책에 따라 platform role=admin 가드를 풀고, `viewAsAdmin` prop 패턴으로 컨텍스트 기반 분기로 바꿨습니다. `PostNewView` 의 비-admin forbidden 리다이렉트도 제거.

라우팅 안전 장치도 하나 넣었습니다. 사내 dev 환경에서 정적 `new/page.tsx` 가 누락되어 `/governance/process/new` 가 동적 `[id]` 라우트로 잡혀 404 가 났던 적이 있어요. `[id]/page.tsx` 에서 `id === "new"` 이면 `PostNewView` 를 직접 렌더하도록 가드를 넣어서, 정적 파일이 누락된 환경에서도 작성 화면이 뜨도록 했습니다.

---

## 전역 입력 스타일

`<input type="date">` 의 달력 picker 아이콘이 오른쪽 끝에 있는 게 어색해서 왼쪽으로 옮겼습니다 (`padding-left: 2rem !important`). 빈 상태(`required + :invalid`) 에서 "연도. 월. 일." 텍스트가 짙은 검정으로 보이던 것도 `gray-400` 으로 흐리게 했고요.

`<input type="number">` 의 브라우저 기본 spinner 화살표도 제거했습니다. 거버넌스 양식은 사용자가 직접 정확한 숫자를 적는 게 맞다고 봐서요.

이게 전역(`globals.css`) 변경이라 다른 팀원의 페이지에도 영향이 갈 수 있다고 별도로 노트했고, 사내 디자인 가이드 통일 관점에서 그대로 두기로 합의했습니다.

---

## 목록 페이지 4종 에러 노출

새로고침하면 데이터가 사라져 보인다는 신고가 있었어요. 코드를 까보니 `.catch(() => setItems([]))` 로 모든 에러를 silently 빈 배열로 만들고 있었습니다. 401 / 네트워크 / DB 비었음이 모두 같은 빈 화면이라 사용자가 원인을 알 수 없었어요.

요청 목록 / 관리 / 정책 / 프로세스 네 페이지의 catch 를 모두 바꿔서, 빨간 안내 박스에 실제 에러 메시지가 뜨도록 했습니다. 디버깅에도 훨씬 도움이 되고, 사용자도 "다시 로그인해야겠다" 같은 판단이 가능해졌어요.

---

## Mock 데이터

테스트용 mock 신청서 8건(REQ-2026-00002 ~ 00009) 을 시드에 추가하고, 시드 함수를 `create` → `upsert` 로 바꿔서 재시드해도 mock 이 갱신되도록 만들었습니다. status 가 다양해야 UI 검증이 되니까 submitted / reviewing / info_requested / approved 가 골고루 섞이도록 분배했고, `info_requested` 상태는 history 도 자동으로 만들어서 `[보완 요청]` 접두를 포함한 entry 가 생기게 했습니다.

---

## API Client 듀얼 셰이프

사내 dev 환경의 strict TS 빌드에서 76 개 에러가 한꺼번에 났던 적이 있어요. 백엔드는 camelCase 인데 옛 datahub-web 컴포넌트들이 snake_case 를 가정하고 있어서 타입이 안 맞은 거였습니다.

처음엔 컴포넌트들을 다 고치는 걸 생각했는데 양이 너무 많아서, **어댑터 함수**(`adaptForm` / `adaptMessage` / `adaptPost`) 를 두고 응답을 양쪽 shape 으로 동시에 노출하기로 했습니다. `FormDetail` 같은 핵심 타입에 `formType` 과 `form_type` 같은 alias 를 모두 포함시켜서, 신규 코드는 camelCase 권장하면서도 옛 컴포넌트가 깨지지 않게 했어요. 좀 지저분하지만 점진적 마이그레이션엔 이게 제일 안전한 패턴이라 생각했습니다.

---

## 빌드 / 배포 시행착오

- `params.entries()` 의 for-of 가 TS target 호환성 때문에 빌드 실패 → `forEach((v, k) => …)` 로 교체
- `Check` / `UserPlus` / `ChevronUp` 같은 lucide-react import 누락으로 빌드 깨진 적 여러 번. 리팩토링 중 컴포넌트를 제거할 때 import 도 같이 빼면서 다른 분기에서 쓰던 걸 놓침. 작은 실수지만 CI 가 매번 잡아줘서 다행이었어요.
- URL `?type=purchase?type=purchase` 이중 query 발생 → `PlanningSubstep` 과 `PlanningFooter` 양쪽에서 query 를 부착하던 중복 제거
- `forms/intake?type=service` 와 `forms/intake` 사이 단일 substep 일 때 빈 빨간 막대 카드만 떠있던 문제 → `ProcessStepper` 가 substep 1 개뿐이면 컨테이너 자체 미렌더

---

## 컴포넌트 / 파일 구조

신규로 추가한 핵심 컴포넌트:

```
components/governance/
├── ProgressBar.tsx                ★ 5단계 막대 + sessionStorage 헬퍼
├── HistoryTimeline.tsx            ★ 가로 진행 이력 + 매핑 헬퍼
├── AttachmentSection.tsx          ★ 첨부파일 업로드/칩
├── stages/
│   └── ApplicationStageTab.tsx    ★ 담당자 지정 + 검토 액션 + 실무자 추가 모달
├── chat/
│   ├── ChatPanel.tsx              ★ 카톡 스타일, 단계 구분선, fillParent
│   └── ChatMessageBubble.tsx      ★ 좌우 분기 + accent 색
└── ApplicationForm/
    └── ServiceExampleModal.tsx    ★ 용역 제작 작성 예시 모달

lib/governance/
└── chat-assignee.ts               ★ 담당자 결정 (FIXED_ASSIGNEE 재사용)
```

기존 컴포넌트는 표 layout 지원, 컨텍스트 기반 분기, sticky 처리, dual-shape 어댑터 등으로 대부분 손이 갔습니다.

---

## Phase 1 sessionStorage 키 정리

백엔드 컬럼이 아직 없어서 임시 영속으로 sessionStorage 를 많이 썼습니다. Phase 2 에서 이걸 백엔드 컬럼·API 로 옮길 거예요:

| 키 | 용도 |
|----|------|
| `dh:gov:service-stage:{formId}` | 5단계 현재 인덱스 |
| `dh:gov:stage1:substep:{formId}` | 신청 단계 내부 sub-step |
| `dh:gov:stage1:members:{formId}` | 실무 담당자 목록 mock |
| `dh:gov:chat-stages:{formId}` | 메시지별 stageAtSent map |
| `dh:gov:attachments:{formId}` | mock 첨부파일 메타데이터 |

---

## 남은 일 (Phase 2)

UI 는 거의 다 갖춰졌는데 백엔드가 따라와야 실사용이 됩니다. 우선순위 순으로 적어두면:

1. **Prisma 스키마 확장**: `GovernanceForm.serviceStage` / `subStep` 컬럼, `GovernanceFormMember` 관계 테이블, `GovernanceFormMessage.stageAtSent`
2. **첨부파일 업로드 API**: GCS 연동. 현재 `uploadFormAttachment` 는 placeholder
3. **사용자 검색 API**: `GET /api/users?search=` — 실무자 추가 모달의 백엔드
4. **담당자 지정 API**: `PATCH /api/governance/forms/{id}/assignees`
5. **단계 전환 알림**: 단계 advance / 메시지 전송 / 담당자 지정 시 자동 알림
6. **역할 기반 권한 가드 복원**: Phase 1 에서 풀어둔 `isAssignee` / `viewAsAdmin` 가드를 실제 백엔드 권한과 연결
7. **dev DB 자동 시드**: 현재는 수동 실행. Helm post-install hook 으로 자동화하면 매 배포마다 mock 갱신 가능
8. **실시간 채팅**: WebSocket / SSE — 현재는 window focus 폴링

---

## 마무리

작업하면서 가장 어려웠던 건 **요구사항이 진화하는 속도** 였습니다. 처음엔 chevron 탭 스타일로 만들었던 ProgressBar 를 막대 채우기형으로 바꾸고, sub-progress 4-cell 막대를 추가했다가 다시 제거하고, 환영 메시지·추천 질문·온라인 배지 등 채팅 헤더 요소들도 추가됐다 빠지고를 반복했어요. 이런 변경을 빠르게 받아들이려면 컴포넌트 prop 설계가 중요했고, 그래서 `accent` / `fillParent` / `viewAsAdmin` / `onShowExample` 같은 옵션 prop 을 잘게 쪼개서 한 컴포넌트로 여러 컨텍스트를 처리하도록 만들었습니다.

Phase 2 에서 백엔드 작업이 들어오면 sessionStorage 부분을 API 호출로 교체하면 되고, UI 자체는 거의 그대로 가져갈 수 있을 거라고 봅니다. 검증/문의 환영합니다.
