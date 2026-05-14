// 계획 수립 substep — 신청 유형(구매/구독/용역) 별 체크리스트 데이터.
//   - 입력 폼이 아닌 자기 점검용. 강제 검증 없음.
//   - 블록 헤더 아이콘은 lucide 직접 import, iconVariant 로 색상 분기.

import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Coins, ListChecks } from "lucide-react";

export type PlanningType = "purchase" | "subscribe" | "service";

export interface PlanningChecklistItem {
  id: string;
  label: string;
  /** 라벨 아래 작은 설명 (11px tertiary). */
  description?: string;
}

export interface PlanningChecklistBlock {
  id: string;
  title: string;
  icon: LucideIcon;
  iconVariant: "info" | "warning";
  /** 블록 본문 위 안내 문장. */
  description?: string;
  items: PlanningChecklistItem[];
}

export const PLANNING_TYPE_LABEL: Record<PlanningType, string> = {
  purchase: "데이터 구매",
  subscribe: "데이터 구독",
  service: "용역 제작",
};

/** PlanningType → FormBuilder 의 FormType 매핑. 신청서 작성 substep 으로 유형 전달용. */
export const PLANNING_TO_FORM_TYPE: Record<PlanningType, string> = {
  purchase: "data_purchase",
  subscribe: "data_subscription",
  service: "data_production",
};

export const PLANNING_CONFIG: Record<PlanningType, PlanningChecklistBlock[]> = {
  service: [
    {
      id: "definitions",
      title: "정의해야 할 항목",
      icon: ListChecks,
      iconVariant: "info",
      description:
        "용역 제작 시 다음 항목을 사전에 정리해 두세요. 신청서 작성 단계에서 입력합니다.",
      items: [
        { id: "purpose", label: "제작 목적을 정의했다" },
        { id: "method", label: "제작 방법을 정의했다" },
        { id: "quantity", label: "제작 수량을 정의했다" },
        { id: "scope", label: "활용 범위를 정의했다" },
        { id: "period", label: "작업 기간을 정의했다" },
      ],
    },
    {
      id: "requirements",
      title: "용역 제작 요건 확인",
      icon: AlertTriangle,
      iconVariant: "warning",
      description: "아래 두 요건을 충족해야 용역 제작 신청이 가능합니다.",
      items: [
        {
          id: "budget-1000",
          label: "예상 작업 규모가 1,000만원 이상이다",
          description: "제작 데이터의 수량과 작업 난이도를 고려해 산정",
        },
        {
          id: "lead-3weeks",
          label: "착수일 기준 3주 전까지 전자결재 단계를 완결할 수 있다",
        },
      ],
    },
  ],
  purchase: [
    {
      id: "definitions",
      title: "정의해야 할 항목",
      icon: ListChecks,
      iconVariant: "info",
      description:
        "데이터 구매 시 다음 항목을 사전에 정리해 두세요. 신청서 작성 단계에서 입력합니다.",
      items: [
        { id: "target", label: "구매 대상 데이터를 정의했다" },
        { id: "purpose", label: "구매 목적을 정의했다" },
        { id: "scope", label: "활용 범위를 정의했다" },
        { id: "period", label: "필요 기간을 정의했다" },
      ],
    },
    {
      id: "budget",
      title: "예산 확인",
      icon: Coins,
      iconVariant: "info",
      items: [
        { id: "budget", label: "구매 예산을 확인했다" },
        { id: "cost", label: "구매 비용을 확인했다" },
      ],
    },
  ],
  subscribe: [
    {
      id: "definitions",
      title: "정의해야 할 항목",
      icon: ListChecks,
      iconVariant: "info",
      description:
        "데이터 구독 시 다음 항목을 사전에 정리해 두세요. 신청서 작성 단계에서 입력합니다.",
      items: [
        { id: "target", label: "구독 대상 데이터를 정의했다" },
        { id: "purpose", label: "구독 목적을 정의했다" },
        { id: "scope", label: "활용 범위를 정의했다" },
        { id: "period", label: "필요 기간을 정의했다" },
      ],
    },
    {
      id: "budget",
      title: "예산 확인",
      icon: Coins,
      iconVariant: "info",
      items: [
        { id: "budget", label: "구독 예산을 확인했다" },
        { id: "cost", label: "구독 비용을 확인했다" },
      ],
    },
  ],
};
