// 클라이언트 마운트 후 sessionStorage 의 planningType 을 반환하는 훅.
//   초기 렌더(SSR) 는 service 기본값. 각 substep 페이지가 stages·substep 정의를
//   유형별로 분기할 때 사용.

"use client";

import { useEffect, useState } from "react";
import {
  getPlanningTypeFromStorage,
  isPlanningType,
} from "./application-type-meta";
import type { PlanningType } from "./planning-config";

export function usePlanningType(): PlanningType {
  const [type, setType] = useState<PlanningType>("service");
  useEffect(() => {
    const t = getPlanningTypeFromStorage();
    if (isPlanningType(t)) setType(t);
  }, []);
  return type;
}
