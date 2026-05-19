// 거버넌스 요청 목록 상단의 상태 필터 탭 — 전체 / 진행 중 / 완료 3 분류.
//   활성 탭은 brand red 텍스트 + 하단 2px brand 인디케이터 + red-tinted 카운트.
//   비활성 탭은 회색 텍스트 + 회색 카운트. 폰트 weight 400/500.

"use client";

export type TabFilter = "all" | "draft" | "in-progress" | "completed";

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
        className="-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 border-brand px-4 py-2.5 text-[14px] font-medium text-brand"
      >
        {tab.label}
        <CountBadge count={tab.count} isActive />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected="false"
      className="-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-[14px] text-gray-500 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      {tab.label}
      <CountBadge count={tab.count} />
    </button>
  );
}

function CountBadge({ count, isActive }: { count: number; isActive?: boolean }) {
  const cls = isActive
    ? "bg-red-50 text-brand dark:bg-red-900/30 dark:text-red-300"
    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
  return (
    <span
      className={`inline-flex items-center rounded-lg px-1.5 py-px text-[11px] font-medium leading-none ${cls}`}
    >
      {count}
    </span>
  );
}
