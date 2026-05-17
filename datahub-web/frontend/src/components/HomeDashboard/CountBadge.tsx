// 카운트 배지 — 위젯 헤더에 표시할 항목 개수. info 톤(파랑) 으로 통일.

interface Props {
  count: number;
}

export function CountBadge({ count }: Props) {
  return (
    <span className="inline-flex min-w-[20px] items-center justify-center rounded-lg bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
      {count}
    </span>
  );
}
