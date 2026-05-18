// 2단계 페이지 전용 stepper — phase pill + 3 substep 진행 바.
//   substep 라벨 클릭 시 페이지 이동이 아닌 같은 페이지 내 해당 카드로 부드럽게 스크롤.
//   완료 = 녹색 #1D9E75 bar, 첫 current = brand red bar + weight 500 label,
//   첫 current 이후의 current/locked = 회색 bar + 회색 라벨 (시각적으로 한 단계만 강조).
//   모든 substep 클릭으로 스크롤 가능 (정식 잠금 동작은 페이지 본문 카드가 담당).

"use client";

import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";
import type { StepStatus } from "./useBuildPhase";

interface Substep {
  id: string;
  label: string;
  status: StepStatus;
}

interface Props {
  substeps: Substep[];
  onScrollTo: (id: string) => void;
}

export function BuildStepper({ substeps, onScrollTo }: Props) {
  // 여러 substep 이 동시에 'current' 일 수 있는 데모 모드에서, 시각적으로는 첫 current 만 강조.
  const firstCurrentIdx = substeps.findIndex((s) => s.status === "current");

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      {/* phase pill */}
      <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="mr-1 text-[11px] text-gray-400 dark:text-gray-500">전체</span>
        <Link
          href="/governance/forms/planning"
          className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          1. 기획
        </Link>
        <ChevronRight size={12} aria-hidden="true" className="text-gray-300 dark:text-gray-600" />
        <span
          aria-current="step"
          className="rounded-full bg-red-50 px-2.5 py-0.5 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
        >
          2. 구축
        </span>
        <ChevronRight size={12} aria-hidden="true" className="text-gray-300 dark:text-gray-600" />
        <Link
          href="/governance/forms/intake/load"
          className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          3. 적재
        </Link>
      </div>

      {/* substep bars */}
      <div className="grid grid-cols-3 gap-1.5">
        {substeps.map((s, idx) => {
          const isDone = s.status === "done";
          const isCurrentVisual = s.status === "current" && idx === firstCurrentIdx;

          const bar = isDone
            ? "bg-[#1D9E75]"
            : isCurrentVisual
            ? "bg-brand"
            : "bg-gray-200 dark:bg-gray-700";

          const labelClass = isCurrentVisual
            ? "font-medium text-red-700 dark:text-red-300"
            : isDone
            ? "text-gray-700 dark:text-gray-300"
            : "text-gray-400 dark:text-gray-500";

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onScrollTo(s.id)}
              aria-current={isCurrentVisual ? "step" : undefined}
              className="block w-full cursor-pointer text-center"
            >
              <div className={`mb-1.5 h-1 rounded-full ${bar}`} />
              <div
                className={`flex items-center justify-center gap-1 text-[11px] ${labelClass}`}
              >
                {isDone && (
                  <Check size={11} aria-hidden="true" className="text-[#1D9E75]" />
                )}
                <span className="whitespace-normal">{s.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
