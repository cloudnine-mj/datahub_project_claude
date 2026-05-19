// API 활용 계획서 — '전체 흐름 요약' 패널.
//   1단계 / 2단계 박스를 좌우에 배치하고 그 사이에 chevron. 각 박스 안에 substep 을
//   ①②③ 번호 매김 리스트로 노출. 현재 단계의 헤더 라벨을 강조.

"use client";

import { ChevronRight } from "lucide-react";
import { API_PROCESS, phaseOf, type ApiPhaseDef, type ApiSubstepId } from "@/lib/governance/forms/api-process-config";

interface Props {
  /** 현재 substep — 어느 단계가 활성인지 헤더 강조용. */
  currentSubstep: ApiSubstepId;
}

const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥"];

export function ApiProcessSummary({ currentSubstep }: Props) {
  const currentPhaseId = phaseOf(currentSubstep).id;
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3.5 dark:border-gray-800 dark:bg-gray-800/30">
      <h2 className="mb-2.5 text-[13px] font-medium text-gray-800 dark:text-gray-200">
        전체 흐름 요약
      </h2>
      <div className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr]">
        <PhaseSummaryCard phase={API_PROCESS[0]} isActive={currentPhaseId === "plan"} />
        <ChevronRight
          size={18}
          aria-hidden="true"
          className="hidden self-center text-gray-300 dark:text-gray-600 md:block"
        />
        <PhaseSummaryCard phase={API_PROCESS[1]} isActive={currentPhaseId === "operate"} />
      </div>
    </section>
  );
}

function PhaseSummaryCard({ phase, isActive }: { phase: ApiPhaseDef; isActive: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-700 dark:bg-gray-900">
      <div
        className={`mb-1.5 text-[12px] ${
          isActive
            ? "font-medium text-blue-700 dark:text-blue-300"
            : "font-medium text-gray-700 dark:text-gray-300"
        }`}
      >
        {phase.label}
      </div>
      <ul className="space-y-0.5 text-[12px] text-gray-700 dark:text-gray-300">
        {phase.substeps.map((s, i) => (
          <li key={s.id}>
            <span className="mr-1 text-gray-400 dark:text-gray-500">
              {CIRCLED_NUMBERS[i] ?? `${i + 1}.`}
            </span>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
