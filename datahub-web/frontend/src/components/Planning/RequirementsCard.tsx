// 계획 수립 — 용역 전용 '용역 제작 요건 확인' 카드.
//   질문형 요건 (체크박스 없음). main + 선택 sub 설명.

import { AlertTriangle } from "lucide-react";
import type { PlanningRequirement } from "@/lib/planningConfig";

interface Props {
  requirements: PlanningRequirement[];
}

export function RequirementsCard({ requirements }: Props) {
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
        {requirements.map((r) => (
          <li
            key={r.main}
            className="rounded-md bg-gray-50 px-3 py-2.5 text-[13px] dark:bg-gray-800/40"
          >
            <p className="text-gray-800 dark:text-gray-200">{r.main}</p>
            {r.sub && (
              <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                {r.sub}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
