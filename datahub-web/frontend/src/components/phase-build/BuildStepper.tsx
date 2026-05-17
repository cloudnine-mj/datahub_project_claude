// 2단계 페이지 전용 stepper — phase pill + 3 substep 진행 바.
//   substep 라벨 클릭 시 페이지 이동이 아닌 같은 페이지 내 해당 카드로 부드럽게 스크롤.
//   잠긴 substep 은 disabled (자물쇠 아이콘).
//   완료 = 녹색 #1D9E75 bar, 현재 = brand red bar + weight 500 label, 잠금 = 회색 bar.

"use client";

import Link from "next/link";
import { ChevronRight, Check, Lock } from "lucide-react";
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
        {substeps.map((s) => {
          const isDone = s.status === "done";
          const isCurrent = s.status === "current";
          const isLocked = s.status === "locked";

          const bar = isDone
            ? "bg-[#1D9E75]"
            : isCurrent
            ? "bg-brand"
            : "bg-gray-200 dark:bg-gray-700";

          const labelClass = isCurrent
            ? "font-medium text-red-700 dark:text-red-300"
            : isDone
            ? "text-gray-700 dark:text-gray-300"
            : "text-gray-400 dark:text-gray-500";

          return (
            <button
              key={s.id}
              type="button"
              disabled={isLocked}
              onClick={() => onScrollTo(s.id)}
              aria-current={isCurrent ? "step" : undefined}
              className={`block w-full text-center disabled:cursor-not-allowed disabled:opacity-60 ${
                isLocked ? "" : "cursor-pointer"
              }`}
            >
              <div className={`mb-1.5 h-1 rounded-full ${bar}`} />
              <div
                className={`flex items-center justify-center gap-1 text-[11px] ${labelClass}`}
              >
                {isDone && (
                  <Check size={11} aria-hidden="true" className="text-[#1D9E75]" />
                )}
                {isLocked && (
                  <Lock size={10} aria-hidden="true" className="text-gray-400 dark:text-gray-500" />
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
