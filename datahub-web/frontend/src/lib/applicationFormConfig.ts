// 1. 기획 / substep 2 신청서 작성 — 양식 config + 상태/이력 타입.
//   유형(service/purchase/subscribe) 별로 섹션·필드 구성이 다름.
//   상태(draft/submitted/reviewing/approved) 는 페이지 컨테이너에서 분기.

export type ApplicationStatus = "draft" | "submitted" | "reviewing" | "approved";
export type ApplicationType = "service" | "purchase" | "subscribe";

export const APPLICATION_TYPE_LABEL: Record<ApplicationType, string> = {
  service: "용역 제작",
  purchase: "데이터 구매",
  subscribe: "데이터 구독",
};

export type FormFieldType =
  | "input"
  | "textarea"
  | "disabled"
  | "date-range"
  | "number-with-unit"
  | "file";

export interface FormFieldDef {
  id: string;
  label: string;
  type: FormFieldType;
  placeholder?: string;
  /** number-with-unit 의 우측 단위 ('원' 등). */
  unit?: string;
  /** file 등 일부 필드 하단 안내문. */
  helperText?: string;
}

export interface FormSectionDef {
  id: string;
  title: string;
  required: boolean;
  fields: FormFieldDef[];
}

export const APPLICATION_FORM_CONFIG: Record<ApplicationType, FormSectionDef[]> = {
  service: [
    {
      id: "basic",
      title: "기본 정보",
      required: true,
      fields: [
        {
          id: "dataName",
          label: "데이터명",
          type: "input",
          placeholder: "예) 한국어 도메인 특화 음성 코퍼스",
        },
        { id: "applicant", label: "신청자", type: "disabled" },
      ],
    },
    {
      id: "plan",
      title: "제작 계획",
      required: true,
      fields: [
        {
          id: "purpose",
          label: "제작 목적",
          type: "textarea",
          placeholder: "어떤 모델·서비스에 활용할 데이터인지 작성",
        },
        {
          id: "method",
          label: "제작 방법",
          type: "textarea",
          placeholder: "수집·라벨링·검증 등 제작 절차 설명",
        },
        { id: "quantity", label: "제작 수량", type: "input", placeholder: "예) 20,000건" },
        { id: "scope", label: "활용 범위", type: "input", placeholder: "예) 사내 모델 학습 한정" },
        { id: "period", label: "작업 기간", type: "date-range" },
      ],
    },
    {
      id: "budget",
      title: "예산",
      required: true,
      fields: [
        {
          id: "cost",
          label: "예상 비용",
          type: "number-with-unit",
          unit: "원",
          placeholder: "예) 16,500,000",
        },
      ],
    },
    {
      id: "attachments",
      title: "첨부 파일",
      required: false,
      fields: [
        {
          id: "files",
          label: "파일",
          type: "file",
          helperText: "샘플 데이터, 작업 가이드라인 등 · 최대 50MB",
        },
      ],
    },
  ],
  purchase: [
    {
      id: "basic",
      title: "기본 정보",
      required: true,
      fields: [
        {
          id: "dataName",
          label: "데이터명",
          type: "input",
          placeholder: "예) 한국어 음성 코퍼스 라이선스",
        },
        { id: "applicant", label: "신청자", type: "disabled" },
      ],
    },
    {
      id: "plan",
      title: "구매 계획",
      required: true,
      fields: [
        {
          id: "targetData",
          label: "구매 대상 데이터",
          type: "textarea",
          placeholder: "구매하려는 데이터셋의 세부 정보",
        },
        {
          id: "purpose",
          label: "구매 목적",
          type: "textarea",
          placeholder: "어떤 용도로 사용할지 작성",
        },
        { id: "scope", label: "활용 범위", type: "input", placeholder: "예) 사내 모델 학습 한정" },
        { id: "period", label: "필요 기간", type: "input", placeholder: "예) 1회성 구매" },
      ],
    },
    {
      id: "budget",
      title: "예산",
      required: true,
      fields: [
        { id: "cost", label: "예상 비용", type: "number-with-unit", unit: "원" },
      ],
    },
    {
      id: "attachments",
      title: "첨부 파일",
      required: false,
      fields: [
        {
          id: "files",
          label: "파일",
          type: "file",
          helperText: "샘플 데이터, 라이선스 자료 등 · 최대 50MB",
        },
      ],
    },
  ],
  subscribe: [
    {
      id: "basic",
      title: "기본 정보",
      required: true,
      fields: [
        {
          id: "dataName",
          label: "데이터명",
          type: "input",
          placeholder: "예) 뉴스 코퍼스 월간 구독",
        },
        { id: "applicant", label: "신청자", type: "disabled" },
      ],
    },
    {
      id: "plan",
      title: "구독 계획",
      required: true,
      fields: [
        { id: "targetData", label: "구독 대상 데이터", type: "textarea" },
        { id: "purpose", label: "구독 목적", type: "textarea" },
        { id: "scope", label: "활용 범위", type: "input" },
        { id: "period", label: "필요 기간", type: "input", placeholder: "예) 월 정기 · 12개월" },
      ],
    },
    {
      id: "budget",
      title: "예산",
      required: true,
      fields: [
        { id: "cost", label: "예상 비용", type: "number-with-unit", unit: "원" },
      ],
    },
    {
      id: "attachments",
      title: "첨부 파일",
      required: false,
      fields: [
        {
          id: "files",
          label: "파일",
          type: "file",
          helperText: "샘플 데이터 등 · 최대 50MB",
        },
      ],
    },
  ],
};

export type HistoryAction =
  | "임시 저장"
  | "제출됨"
  | "검토 시작"
  | "승인 완료"
  | "신청 취소";

export interface StatusHistoryItem {
  id: string;
  action: HistoryAction;
  actor: string;
  actorRole: "신청자" | "Data Governance Team";
  timestamp: string;
  comment?: string;
}

const FULL_MOCK_HISTORY: StatusHistoryItem[] = [
  {
    id: "h1",
    action: "임시 저장",
    actor: "김데이터",
    actorRole: "신청자",
    timestamp: "5/10 14:22",
  },
  {
    id: "h2",
    action: "제출됨",
    actor: "김데이터",
    actorRole: "신청자",
    timestamp: "5/12 09:15",
  },
  {
    id: "h3",
    action: "검토 시작",
    actor: "김은솔",
    actorRole: "Data Governance Team",
    timestamp: "5/12 11:40",
    comment: "예산 산정 근거 확인 중",
  },
  {
    id: "h4",
    action: "승인 완료",
    actor: "김의순",
    actorRole: "Data Governance Team",
    timestamp: "5/14 16:05",
    comment: "기준 충족 — 진행 가능",
  },
];

export function mockHistoryFor(status: ApplicationStatus): StatusHistoryItem[] {
  if (status === "submitted") return FULL_MOCK_HISTORY.slice(0, 2);
  if (status === "reviewing") return FULL_MOCK_HISTORY.slice(0, 3);
  if (status === "approved") return FULL_MOCK_HISTORY;
  return [];
}
