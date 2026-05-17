// 위젯: 진행중인 신청 — 현재 단계 + 수정일 표.
//   컬럼: 분류(80px) / 제목 / 단계(80px, info 파랑) / 수정일(60px, 우측 정렬).

"use client";

import { CountBadge } from "./CountBadge";
import { TypeChip } from "./TypeChip";
import type { InProgressItem } from "./widget-mock-data";

interface Props {
  items: InProgressItem[];
}

export function InProgressWidget({ items }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-2">
        <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          진행중인 신청
        </h2>
        <CountBadge count={items.length} />
      </header>

      {items.length === 0 ? (
        <p className="py-5 text-center text-[11px] text-gray-400 dark:text-gray-500">
          진행 중인 신청이 없습니다
        </p>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="w-[80px] py-1.5 text-left font-normal text-gray-400 dark:text-gray-500">
                분류
              </th>
              <th className="py-1.5 text-left font-normal text-gray-400 dark:text-gray-500">
                제목
              </th>
              <th className="w-[80px] py-1.5 text-left font-normal text-gray-400 dark:text-gray-500">
                단계
              </th>
              <th className="w-[60px] py-1.5 text-right font-normal text-gray-400 dark:text-gray-500">
                수정일
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr
                key={it.id}
                onClick={() => console.log("in-progress click", it.requestId)}
                className={`cursor-pointer transition hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                  idx < items.length - 1
                    ? "border-b border-gray-100 dark:border-gray-800/60"
                    : ""
                }`}
              >
                <td className="py-2">
                  <TypeChip type={it.type} />
                </td>
                <td className="py-2 text-gray-800 dark:text-gray-200">{it.title}</td>
                <td className="py-2 text-blue-700 dark:text-blue-300">
                  {it.phase}. {it.phaseLabel}
                </td>
                <td className="py-2 text-right text-gray-400 dark:text-gray-500">
                  {it.modifiedAt}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
