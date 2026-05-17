// 계획 수립 substep — 신청 유형(구매/구독/용역) 별 검토 질문 + 작성 예시.
//   - 체크박스 없는 자기 점검 질문 (좌측 카드)
//   - 질문과 1:1 매칭되는 실제 작성 예시 (우측 카드)
//   - 용역만 추가 요건 확인 카드 (RequirementsCard) — main 질문 + 선택 sub 설명.

import type { FormType } from "./api";

export type PlanningType = "purchase" | "subscribe" | "service";

export const PLANNING_TYPE_LABEL: Record<PlanningType, string> = {
  purchase: "데이터 구매",
  subscribe: "데이터 구독",
  service: "용역 제작",
};

/** PlanningType → FormBuilder 의 FormType 매핑. 신청서 작성 substep 으로 유형 전달용. */
export const PLANNING_TO_FORM_TYPE: Record<PlanningType, FormType> = {
  purchase: "data_purchase",
  subscribe: "data_subscription",
  service: "data_production",
};

export interface PlanningReviewExample {
  label: string;
  value: string;
}

export interface PlanningRequirement {
  main: string;
  sub?: string;
}

export interface PlanningReview {
  questions: string[];
  exampleTitle: string;
  exampleSubtitle: string;
  /** questions 와 동일 순서 + 동일 개수. UI 에서 1:1 매칭 가정. */
  exampleItems: PlanningReviewExample[];
  /** 용역 전용 — 구매/구독은 없음. */
  requirements?: PlanningRequirement[];
}

export const PLANNING_REVIEW_CONFIG: Record<PlanningType, PlanningReview> = {
  service: {
    questions: [
      "제작 목적이 무엇인가요?",
      "어떻게 제작할 건가요?",
      "얼마나 필요한가요?",
      "누가, 어디에 쓸 수 있나요?",
      "언제 시작해서 언제 끝나야 하나요?",
    ],
    exampleTitle: "검토 사항 예시",
    exampleSubtitle: "",
    exampleItems: [
      {
        label: "제작 목적",
        value: "EXAONE 음성 인식 모델의 의료 도메인 인식률 개선용 학습 데이터",
      },
      { label: "제작 방법", value: "스튜디오 녹음 + 전문 라벨러 2인 교차 검증" },
      { label: "제작 수량", value: "20,000건 (음성 + 라벨)" },
      { label: "활용 범위", value: "사내 모델 학습 한정, 외부 공개 모델 제외" },
      { label: "작업 기간", value: "2026-07-01 ~ 2026-09-30 (3개월)" },
    ],
    requirements: [
      {
        main: "예상 작업 규모가 1,000만원 이상인가요?",
        sub: "제작 데이터의 수량과 작업 난이도를 고려해 산정",
      },
      { main: "착수일 기준 3주 전까지 전자결재를 완결할 수 있나요?" },
    ],
  },
  purchase: {
    questions: [
      "어떤 데이터를 구매하나요?",
      "왜 필요한가요?",
      "누가, 어디에 쓸 수 있나요?",
      "얼마나 오래 쓸 건가요?",
    ],
    exampleTitle: "검토 사항 예시",
    exampleSubtitle: "",
    exampleItems: [
      {
        label: "구매 대상 데이터",
        value: "한국어 음성 코퍼스 v3 라이선스 (외부 업체 제공)",
      },
      { label: "구매 목적", value: "음성 인식 모델 fine-tuning용 학습 데이터 확보" },
      { label: "활용 범위", value: "사내 모델 학습 한정 (외부 공개 모델 제외)" },
      { label: "필요 기간", value: "영구 사용권 (라이선스 만료 없음)" },
    ],
  },
  subscribe: {
    questions: [
      "어떤 데이터를 구독하나요?",
      "왜 필요한가요?",
      "누가, 어디에 쓸 수 있나요?",
      "얼마나 오래 구독할 건가요?",
    ],
    exampleTitle: "검토 사항 예시",
    exampleSubtitle: "",
    exampleItems: [
      {
        label: "구독 대상 데이터",
        value: "뉴스 코퍼스 월간 피드 (외부 업체 API)",
      },
      { label: "구독 목적", value: "최신 뉴스 기반 트렌드 분석 모델 운영" },
      {
        label: "활용 범위",
        value: "사내 분석 도구에 통합, API 호출 inference용",
      },
      { label: "필요 기간", value: "12개월 구독 (효과 검증 후 갱신 검토)" },
    ],
  },
};
