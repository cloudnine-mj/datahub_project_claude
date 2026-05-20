// 신청서 작성 substep 추적 모드 — 상태/이력/유형 타입 + mock payload.
//   실제 양식 필드 정의는 FORM_SCHEMAS (formSchemas.ts) 가 단일 진실의 원천.
//   여기는 그 위에 얹는 status / history / 페이지 메타데이터만 담당.

import type { FormType } from "./types";

export type ApplicationStatus = "draft" | "submitted" | "reviewing" | "approved";
export type ApplicationType = "service" | "purchase" | "subscribe";

export const APPLICATION_TYPE_LABEL: Record<ApplicationType, string> = {
  service: "용역 제작",
  purchase: "데이터 구매",
  subscribe: "데이터 구독",
};

/** ApplicationType → FormBuilder FormType. 실제 FORM_SCHEMAS 와 연결할 때 사용. */
export const APPLICATION_TO_FORM_TYPE: Record<ApplicationType, FormType> = {
  service: "data_production",
  purchase: "data_purchase",
  subscribe: "data_subscription",
};

/** 추적 모드 데모용 mock payload — FORM_SCHEMAS 의 실제 key 와 일치해야 함. */
export const MOCK_SUBMITTED_PAYLOAD: Record<
  ApplicationType,
  Record<string, unknown>
> = {
  purchase: {
    프로젝트명: "test",
    구매_희망_데이터셋: "한국어 음성 코퍼스 라이선스",
    판매_업체: "예시 데이터 컴퍼니",
    사용_예상_금액: "8,000,000원",
    사용_목적_및_기대_효과: "음성 인식 모델 학습 데이터 보강",
    데이터_품질_검수_담당자: "김데이터",
    compliance_확인_여부: "확인 완료",
    데이터셋_저장_레포지토리: "research-experiment-repo",
  },
  subscribe: {
    프로젝트명: "test",
    구독_희망_데이터셋: "뉴스 코퍼스 월간 피드",
    구독_업체: "예시 미디어",
    구독_기간: "12개월",
    월_사용_예상_금액: "2,400,000원",
    사용_목적: "뉴스 분류 모델 학습 데이터 정기 수급",
  },
  service: {
    관련_프로젝트_PMS: "test",
    데이터셋_활용_목적: "도메인 특화 음성 인식 모델 학습 데이터 제작",
    데이터셋_이름: "한국어 도메인 특화 음성 코퍼스",
    희망_작업_착수일: "2026-06-01",
    희망_수령일: "2026-07-31",
    작업_형태: "음성 수집·라벨링",
    목표_데이터_수량: "20,000",
    단위: "문장",
  },
};

export type HistoryAction =
  | "임시 저장"
  | "제출됨"
  | "검토 시작"
  | "보완 요청"
  | "보완 자료 제출"
  | "검토 재개"
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
