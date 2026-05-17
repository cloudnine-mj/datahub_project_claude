// 신청 유형 칩 — 위젯 row 좌측에서 유형을 한 눈에 구분.
//   대시보드 한정으로 6 variant 유지 (용역/구매/구독 + 로그/API/생산성).

import type { RequestType } from "./widget-mock-data";

const STYLE: Record<RequestType, { label: string; cls: string }> = {
  service: {
    label: "용역",
    cls: "bg-[#FAECE7] text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200",
  },
  purchase: {
    label: "구매",
    cls: "bg-[#E6F1FB] text-[#0C447C] dark:bg-blue-900/40 dark:text-blue-200",
  },
  subscribe: {
    label: "구독",
    cls: "bg-[#E1F5EE] text-[#0F6E56] dark:bg-emerald-900/30 dark:text-emerald-200",
  },
  "product-log": {
    label: "로그",
    cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  api: {
    label: "API",
    cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  productivity: {
    label: "생산성",
    cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

interface Props {
  type: RequestType;
}

export function TypeChip({ type }: Props) {
  const { label, cls } = STYLE[type];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${cls}`}
    >
      {label}
    </span>
  );
}
