// 위젯: 내 할 일 — 사용자가 응답/검수해야 할 항목.
//   배지: 빨강 (urgency 표시). 폰트 weight 400/500 만.

"use client";

import { TypeChip } from "./TypeChip";
import type { TodoItem } from "./widget-mock-data";

interface Props {
  items: TodoItem[];
}

export function TodoWidget({ items }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100">
        내 할 일
        {items.length > 0 && (
          <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-[#E24B4A] px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          응답 대기 중인 할 일이 없습니다
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => console.log("todo click", it.requestId)}
                className="flex w-full items-center gap-2 rounded-md bg-gray-50/60 px-2 py-1.5 text-left transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
              >
                <TypeChip type={it.type} />
                <span className="flex-1 truncate text-xs text-gray-800 dark:text-gray-200">
                  {it.title}
                </span>
                <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                  {it.modifiedAt}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
