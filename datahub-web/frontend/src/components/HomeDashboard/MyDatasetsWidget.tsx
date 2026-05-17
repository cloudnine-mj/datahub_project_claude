// 위젯: 내가 적재한 데이터 — 사용자가 본인 명의로 적재 완료한 데이터 목록.
//   헤더 우측에 '바로가기' 링크.

"use client";

import Link from "next/link";
import { CountBadge } from "./CountBadge";
import type { DatasetItem } from "./widget-mock-data";

interface Props {
  items: DatasetItem[];
}

export function MyDatasetsWidget({ items }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
            내가 적재한 데이터
          </h2>
          <CountBadge count={items.length} />
        </div>
        <Link
          href="/governance/forms/my"
          className="text-[11px] text-blue-700 hover:underline dark:text-blue-300"
        >
          바로가기 →
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="py-5 text-center text-[11px] text-gray-400 dark:text-gray-500">
          아직 적재한 데이터가 없습니다
        </p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="py-1.5 text-left font-normal text-gray-400 dark:text-gray-500">
                데이터셋
              </th>
              <th className="w-[80px] py-1.5 text-right font-normal text-gray-400 dark:text-gray-500">
                적재일
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr
                key={it.id}
                className={
                  idx < items.length - 1
                    ? "border-b border-gray-100 dark:border-gray-800/60"
                    : ""
                }
              >
                <td className="py-2 text-gray-800 dark:text-gray-200">{it.name}</td>
                <td className="py-2 text-right text-gray-400 dark:text-gray-500">
                  {it.loadedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
