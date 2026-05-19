// 최종 데이터 수령 단계 body (current 상태) — 체크박스 1개.
//   완료 조건: 체크박스 체크됨.

"use client";

import type { FinalStep } from "./useBuildPhase";

interface Props {
  final: FinalStep;
  onToggle: () => void;
}

export function FinalStepBody({ final, onToggle }: Props) {
  return (
    <label
      htmlFor="final-received"
      className="flex cursor-pointer items-center gap-2.5 rounded-md bg-gray-50 px-3 py-2 transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
    >
      <input
        id="final-received"
        type="checkbox"
        checked={final.received}
        onChange={onToggle}
        className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand focus:ring-brand"
      />
      <span className="text-[13px] text-gray-800 dark:text-gray-200">
        최종 데이터 수령
      </span>
    </label>
  );
}
