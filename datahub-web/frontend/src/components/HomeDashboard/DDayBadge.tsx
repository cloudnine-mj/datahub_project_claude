// D-day 배지 — 일정 임박도에 따라 색상 분기.
//   D-0, D-1: 긴급 (red)
//   D-2, D-3: 주의 (amber)
//   D-4+:    정상 (gray)

interface Props {
  dDay: number;
}

export function DDayBadge({ dDay }: Props) {
  let cls: string;
  if (dDay <= 1) {
    cls = "bg-[#F7C1C1] text-[#791F1F] dark:bg-red-900/40 dark:text-red-200";
  } else if (dDay <= 3) {
    cls = "bg-[#FAC775] text-[#633806] dark:bg-amber-900/40 dark:text-amber-200";
  } else {
    cls = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium leading-none ${cls}`}
    >
      D-{dDay}
    </span>
  );
}
