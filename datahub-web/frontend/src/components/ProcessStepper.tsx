// 2층 stepper — 데이터 도입 프로세스 (1. 기획 / 2. 구축 / 3. 적재) 진행 표시.
//   상단 라인: '전체' 라벨 + 3 phase chevron (현재 phase 만 파란 pill, 나머지 회색)
//   하단 라인: 현재 phase 의 4개 sub-step 진행바 + 라벨
// 폰트 weight 는 400/500 만 사용 (font-normal, font-medium). 600/700 금지.

"use client";

import { Check } from "lucide-react";

interface Phase {
  num: number;
  label: string;
}
const PHASES: Phase[] = [
  { num: 1, label: "1. 기획" },
  { num: 2, label: "2. 구축" },
  { num: 3, label: "3. 적재" },
];

interface SubStep {
  label: string;
}
// 현재는 phase 1 (기획) 의 sub-step 만 정의. 다른 phase 가 필요해지면 phase 별
// 배열을 추가하고 props 로 분기.
const SUB_STEPS_PHASE_1: SubStep[] = [
  { label: "필요성 정의·예산" },
  { label: "신청서 작성" },
  { label: "담당자 논의·확정" },
  { label: "전자결재" },
];

interface Props {
  /** 현재 진행 중인 phase (1 / 2 / 3) */
  currentPhase: 1 | 2 | 3;
  /** 현재 phase 내의 sub-step 인덱스 (1-based) */
  currentSubStep: number;
}

export function ProcessStepper({ currentPhase, currentSubStep }: Props) {
  const subSteps = currentPhase === 1 ? SUB_STEPS_PHASE_1 : [];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* 상단 — 3 phase */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="text-gray-500 dark:text-gray-400">전체</span>
        {PHASES.map((p, i) => (
          <span key={p.num} className="flex items-center gap-2">
            {p.num === currentPhase ? (
              <span className="rounded-full bg-[#E6F1FB] px-3 py-1 font-medium text-[#185FA5] dark:bg-blue-900/30 dark:text-blue-300">
                {p.label}
              </span>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{p.label}</span>
            )}
            {i < PHASES.length - 1 && (
              <span className="text-gray-300 dark:text-gray-600">›</span>
            )}
          </span>
        ))}
      </div>

      {/* 하단 — 현재 phase 의 sub-step bar + label */}
      {subSteps.length > 0 && (
        <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${subSteps.length}, minmax(0, 1fr))` }}>
          {subSteps.map((s, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < currentSubStep;
            const isCurrent = stepNum === currentSubStep;
            const barClass = isDone
              ? "bg-[#1D9E75] dark:bg-[#1D9E75]"
              : isCurrent
              ? "bg-[#185FA5] dark:bg-[#185FA5]"
              : "bg-gray-200 dark:bg-gray-700";
            const labelClass = isCurrent
              ? "font-medium text-[#185FA5] dark:text-blue-300"
              : isDone
              ? "text-gray-700 dark:text-gray-300"
              : "text-gray-400 dark:text-gray-500";
            return (
              <div key={s.label} className="flex flex-col">
                <div className={`h-1 rounded-full ${barClass}`} />
                <div className={`mt-2 flex items-center justify-center gap-1 text-xs ${labelClass}`}>
                  {isDone && <Check size={12} className="text-[#1D9E75]" />}
                  <span className="whitespace-nowrap">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
