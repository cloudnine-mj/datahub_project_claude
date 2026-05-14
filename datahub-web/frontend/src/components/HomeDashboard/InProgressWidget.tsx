// 위젯: 진행 중인 신청 — 각 row 에 현재 단계 + 진행률 바.
//   배지·진행률 바 모두 브랜드 빨강 톤 (신청서 양식과 통일).

"use client";

import { TypeChip } from "./TypeChip";
import type { InProgressItem } from "./widget-mock-data";

interface Props {
  items: InProgressItem[];
}

export function InProgressWidget({ items }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100">
        진행 중인 신청
        {items.length > 0 && (
          <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          진행 중인 신청이 없습니다
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => console.log("in-progress click", it.requestId)}
                className="flex w-full flex-col gap-1.5 rounded-md bg-gray-50/60 px-2 py-1.5 text-left transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-2">
                  <TypeChip type={it.type} />
                  <span className="flex-1 truncate text-xs text-gray-800 dark:text-gray-200">
                    {it.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[10px] text-gray-500 dark:text-gray-400">
                    {it.phase}. {it.phaseLabel}
                  </span>
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${it.progressPercent}%` }}
                    />
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
