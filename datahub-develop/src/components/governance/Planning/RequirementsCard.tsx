// 계획 수립 — 용역 전용 '용역 제작 요건 확인' 카드.
//   각 요건은 체크박스 + main 라벨 + 선택 sub 설명.

"use client";

import { AlertTriangle } from "lucide-react";
import type { PlanningRequirement } from "@/lib/governance/forms/planning-config";

interface Props {
  requirements: PlanningRequirement[];
  checks: Record<string, boolean>;
  onToggle: (key: string) => void;
}

export function RequirementsCard({ requirements, checks, onToggle }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-1.5 flex items-center gap-1.5">
        <AlertTriangle
          size={16}
          aria-hidden="true"
          className="text-amber-700 dark:text-amber-300"
        />
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          용역 제작 요건 확인
        </h3>
      </header>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        다음 두 요건을 충족해야 신청 가능합니다.
      </p>
      <ul className="flex flex-col gap-1.5">
        {requirements.map((r) => {
          const id = `req-${r.main}`;
          return (
            <li key={r.main}>
              <label
                htmlFor={id}
                className="flex cursor-pointer items-start gap-2.5 rounded-md bg-gray-50 px-3 py-2.5 transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={!!checks[r.main]}
                  onChange={() => onToggle(r.main)}
                  className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-gray-800 dark:text-gray-200">{r.main}</p>
                  {r.sub && (
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                      {r.sub}
                    </p>
                  )}
                </div>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
