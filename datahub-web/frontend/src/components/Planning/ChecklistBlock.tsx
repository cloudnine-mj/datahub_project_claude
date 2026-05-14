// 계획 수립 체크리스트 블록 — 헤더(아이콘 + 제목) + 안내문 + 항목 리스트.
//   각 항목은 <label> 로 감싸 라벨 클릭으로도 토글 가능 (접근성).
//   iconVariant: 'info' (brand 빨강) / 'warning' (amber).

"use client";

import type { PlanningChecklistBlock } from "@/lib/planningConfig";

interface Props {
  block: PlanningChecklistBlock;
  /** 체크 상태 — itemId → boolean. */
  checks: Record<string, boolean>;
  onToggle: (itemId: string) => void;
}

export function ChecklistBlock({ block, checks, onToggle }: Props) {
  const Icon = block.icon;
  const iconClass =
    block.iconVariant === "warning"
      ? "text-amber-700 dark:text-amber-300"
      : "text-red-700 dark:text-red-300";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
        <Icon size={16} aria-hidden="true" className={iconClass} />
        {block.title}
      </header>
      {block.description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {block.description}
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {block.items.map((item) => (
          <li key={item.id}>
            <ItemRow
              id={`${block.id}-${item.id}`}
              label={item.label}
              description={item.description}
              checked={!!checks[item.id]}
              onToggle={() => onToggle(item.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ItemRow({
  id,
  label,
  description,
  checked,
  onToggle,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-md bg-gray-50 px-3 py-2 transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-[2px] h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-gray-800 dark:text-gray-200">{label}</p>
        {description && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {description}
          </p>
        )}
      </div>
    </label>
  );
}
