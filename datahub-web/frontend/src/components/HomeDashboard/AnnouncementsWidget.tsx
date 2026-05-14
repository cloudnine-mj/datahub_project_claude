// 위젯: 최근 공지 — 거버넌스 정책/프로세스 변경 등 공지 사항.
//   배지: 회색.

"use client";

import type { AnnouncementItem } from "./widget-mock-data";

interface Props {
  items: AnnouncementItem[];
}

export function AnnouncementsWidget({ items }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100">
        최근 공지
        {items.length > 0 && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">새 공지가 없습니다</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-0.5">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-2 px-2 py-1 text-xs"
            >
              <span className="truncate text-gray-700 dark:text-gray-300">{it.title}</span>
              <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                {it.date}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
