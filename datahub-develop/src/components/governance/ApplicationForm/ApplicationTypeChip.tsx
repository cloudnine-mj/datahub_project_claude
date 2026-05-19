// 신청 유형 칩 — 양식 헤더에 표시되는 작은 라벨.
//   3가지 톤 분기: 용역(coral) / 구매(brand red) / 구독(teal).

import {
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from "@/lib/governance/forms/application-config";

const STYLE: Record<ApplicationType, string> = {
  service:
    "bg-[#FAECE7] text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200",
  purchase:
    "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  subscribe:
    "bg-[#E1F5EE] text-[#0F6E56] dark:bg-emerald-900/30 dark:text-emerald-200",
};

export function ApplicationTypeChip({ type }: { type: ApplicationType }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${STYLE[type]}`}
    >
      {APPLICATION_TYPE_LABEL[type]}
    </span>
  );
}
