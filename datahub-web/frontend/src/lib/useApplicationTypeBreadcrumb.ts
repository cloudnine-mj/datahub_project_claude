// 데이터 용역/구매/구독 substep 페이지 공용 — sessionStorage 기준 현재 유형의
//   Breadcrumb 항목을 반환. 초기 렌더(SSR) 는 service 기본값, 클라이언트 마운트
//   직후 sessionStorage 값으로 정정.

"use client";

import { useEffect, useState } from "react";
import {
  APPLICATION_TYPE_META,
  getPlanningTypeFromStorage,
} from "@/lib/applicationTypeMeta";
import type { PlanningType } from "@/lib/planningConfig";

export interface TypeCrumb {
  label: string;
  href: string;
}

export function useApplicationTypeBreadcrumb(): TypeCrumb {
  const [type, setType] = useState<PlanningType>("service");
  useEffect(() => {
    setType(getPlanningTypeFromStorage());
  }, []);
  const meta = APPLICATION_TYPE_META[type];
  return {
    label: meta.label,
    href: `/governance/forms/planning?type=${type}`,
  };
}
