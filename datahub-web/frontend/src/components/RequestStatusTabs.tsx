// 거버넌스 요청 목록 상단의 상태 필터 탭 — 전체 / 진행 중 / 완료 3 분류.
//   활성 탭은 흰 배경 + 0.5px 보더(하단 제외), 비활성은 transparent + secondary 톤.
//   각 탭에 카운트 배지(캡슐 회색). 폰트 weight 400/500.

"use client";

export type TabFilter = "all" | "in-progress" | "completed";

export interface StatusTab {
  value: TabFilter;
  label: string;
  count: number;
}

interface Props {
  tabs: StatusTab[];
  activeTab: TabFilter;
  onTabChange: (tab: TabFilter) => void;
}

export function RequestStatusTabs({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div
      role="tablist"
      className="mb-[14px] flex gap-1 border-b border-gray-200 dark:border-gray-800"
    >
      {tabs.map((tab) => (
        <StatusTabButton
          key={tab.value}
          tab={tab}
          isActive={tab.value === activeTab}
          onClick={() => onTabChange(tab.value)}
        />
      ))}
    </div>
  );
}

function StatusTabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: StatusTab;
  isActive: boolean;
  onClick: () => void;
}) {
  if (isActive) {
    return (
      <button
        type="button"
        onClick={onClick}
        role="tab"
        aria-selected="true"
        aria-current="page"
        className="-mb-px inline-flex cursor-pointer items-center gap-1.5 rounded-t-lg border border-gray-200 border-b-transparent bg-white px-3.5 py-2 text-[13px] font-medium text-gray-900 dark:border-gray-800 dark:border-b-transparent dark:bg-gray-900 dark:text-gray-100"
      >
        {tab.label}
        <CountBadge count={tab.count} />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected="false"
      className="inline-flex cursor-pointer items-center gap-1.5 px-3.5 py-2 text-[13px] text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      {tab.label}
      <CountBadge count={tab.count} />
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-gray-100 px-1.5 py-px text-[10px] leading-none text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {count}
    </span>
  );
}
