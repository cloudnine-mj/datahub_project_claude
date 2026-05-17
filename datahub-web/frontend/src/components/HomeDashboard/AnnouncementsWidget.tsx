// 위젯: 최근 공지 — 거버넌스 정책/프로세스 변경 등 공지 사항.
//   각 항목에 '중요' 배지(조건부) + 날짜 + 제목.

"use client";

import Link from "next/link";
import { CountBadge } from "./CountBadge";
import type { NoticeItem } from "./widget-mock-data";

interface Props {
  items: NoticeItem[];
}

export function AnnouncementsWidget({ items }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
            최근 공지
          </h2>
          <CountBadge count={items.length} />
        </div>
        <Link
          href="/governance/coming-soon?from=notices"
          className="text-[11px] text-blue-700 hover:underline dark:text-blue-300"
        >
          바로가기 →
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="py-5 text-center text-[11px] text-gray-400 dark:text-gray-500">
          새 공지가 없습니다
        </p>
      ) : (
        <ul>
          {items.map((it, idx) => (
            <li
              key={it.id}
              className={`py-2 ${
                idx < items.length - 1
                  ? "border-b border-gray-100 dark:border-gray-800/60"
                  : ""
              }`}
            >
              <div className="mb-0.5 flex items-center gap-1.5">
                {it.isImportant && (
                  <span className="inline-flex items-center rounded bg-[#F7C1C1] px-1.5 py-0.5 text-[9px] font-medium leading-none text-[#791F1F] dark:bg-red-900/40 dark:text-red-200">
                    중요
                  </span>
                )}
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {it.publishedAt}
                </span>
              </div>
              <div className="text-[11px] text-gray-800 dark:text-gray-200">
                {it.title}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
