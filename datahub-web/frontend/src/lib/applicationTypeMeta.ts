// 데이터 용역/구매/구독 — 유형별 메타데이터.
//   사이드바 라벨 / 페이지 헤더 / 안내 문구 단일 출처.

import { Hammer, RefreshCw, ShoppingCart, type LucideIcon } from "lucide-react";
import type { PlanningType } from "./planningConfig";

export interface ApplicationTypeMeta {
  type: PlanningType;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const APPLICATION_TYPE_META: Record<PlanningType, ApplicationTypeMeta> = {
  service: {
    type: "service",
    label: "데이터 용역 제작",
    description: "외주 업체에 데이터 라벨링·수집·검수 작업을 의뢰하는 신청입니다.",
    icon: Hammer,
  },
  purchase: {
    type: "purchase",
    label: "데이터 구매",
    description:
      "외부 데이터셋을 일회성으로 구매하는 신청입니다. 라이선스·예산 검토를 동반합니다.",
    icon: ShoppingCart,
  },
  subscribe: {
    type: "subscribe",
    label: "데이터 구독",
    description: "정기적으로 갱신되는 데이터를 월/연 단위로 구독하는 신청입니다.",
    icon: RefreshCw,
  },
};

export function isPlanningType(v: string | null | undefined): v is PlanningType {
  return v === "service" || v === "purchase" || v === "subscribe";
}
