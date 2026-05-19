// 위젯: 최근 일정 — 우측 사이드 영역 (데스크톱 240px 너비).
//   각 카드: 날짜 + D-day 배지 + 제목. D-day 색상은 임박도에 따라 분기.

"use client";

import { CountBadge } from "./CountBadge";
import { DDayBadge } from "./DDayBadge";
import type { UpcomingEvent } from "./widget-mock-data";

interface Props {
  items: UpcomingEvent[];
}

export function UpcomingEventsWidget({ items }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-3.5 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-2">
        <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          최근 일정
        </h2>
        <CountBadge count={items.length} />
      </header>

      {items.length === 0 ? (
        <p className="py-5 text-center text-[11px] text-gray-400 dark:text-gray-500">
          예정된 일정이 없습니다
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((it, idx) => (
            <li
              key={it.id}
              className={`${
                idx < items.length - 1
                  ? "border-b border-gray-100 pb-2.5 dark:border-gray-800/60"
                  : ""
              }`}
            >
              <button
                type="button"
                onClick={() => console.log("event click", it.id)}
                className="block w-full text-left"
              >
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-400 dark:text-gray-500">
                    {it.date}
                  </span>
                  <DDayBadge dDay={it.dDay} />
                </div>
                <div className="text-[11px] leading-[1.4] text-gray-800 dark:text-gray-200">
                  {it.title}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
