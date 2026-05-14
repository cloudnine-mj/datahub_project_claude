// 메뉴 항목 옆 작은 배지 — 항목별 카운트/상태 표시.
//   variant: info(파랑)·danger(빨강)·neutral(회색). 폰트 weight 는 500 만.

import type { BadgeVariant } from "./sidebar.config";

interface Props {
  count: number | string;
  variant: BadgeVariant;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  info: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

export function MenuBadge({ count, variant }: Props) {
  return (
    <span
      className={`inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${VARIANT_CLASS[variant]}`}
    >
      {count}
    </span>
  );
}
