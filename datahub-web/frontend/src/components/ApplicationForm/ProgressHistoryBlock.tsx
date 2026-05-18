// 진행 이력 카드 — 최신순 세로 타임라인, 접기/펼치기 토글.
//   가장 최근(맨 위) 항목은 brand red 채움 노드, 나머지는 빈 원.
//   각 항목: 액션명 + 타임스탬프 + 작성자 (역할·이름) + 선택 코멘트 박스.

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { StatusHistoryItem } from "@/lib/applicationFormConfig";

interface Props {
  history: StatusHistoryItem[];
}

export function ProgressHistoryBlock({ history }: Props) {
  const [open, setOpen] = useState(false);

  if (history.length === 0) return null;

  // 최신순(역순) 정렬. 첫 항목 = 가장 최근 = 현재 진행 강조.
  const ordered = history.slice().reverse();

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">진행 이력</h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {history.length}건
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {open ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
          {open ? "접기" : "펼치기"}
        </button>
      </header>

      {open && (
        <ol className="pl-1">
          {ordered.map((h, i) => {
            const isCurrent = i === 0;
            const isLast = i === ordered.length - 1;
            return (
              <li key={h.id} className="relative pl-6 pb-4 last:pb-0">
                {/* 세로 연결선 1px — 노드 중심(7px)을 지나가도록. 마지막 항목 제외. */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-[7px] top-4 w-px bg-gray-200 dark:bg-gray-700"
                  />
                )}
                {/* 노드 15px — 현재(맨 위) brand red 채움, 과거 빈 원 */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full ${
                    isCurrent
                      ? "bg-brand"
                      : "border-2 border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900"
                  }`}
                />
                <div>
                  <p className="text-sm">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {h.action}
                    </span>
                    <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                      {h.timestamp}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                    {h.actorRole} · {h.actor}
                  </p>
                  {h.comment && (
                    <div className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-[12px] text-gray-700 dark:bg-gray-800/40 dark:text-gray-300">
                      {h.comment}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
