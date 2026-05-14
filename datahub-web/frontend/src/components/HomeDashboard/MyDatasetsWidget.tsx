// 위젯: 내가 적재한 데이터 — 사용자가 본인 명의로 적재 완료한 데이터 목록.
//   배지: 회색 (단순 카운트).

"use client";

import type { DatasetItem } from "./widget-mock-data";

interface Props {
  items: DatasetItem[];
}

export function MyDatasetsWidget({ items }: Props) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-gray-900 dark:text-gray-100">
        내가 적재한 데이터
        {items.length > 0 && (
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {items.length}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          아직 적재한 데이터가 없습니다
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-0.5">
          {items.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => console.log("dataset click", it.id)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <span className="truncate">{it.name}</span>
                <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                  {it.loadedAt}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
