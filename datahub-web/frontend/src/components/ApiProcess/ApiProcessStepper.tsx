// API 활용 계획서 — 2단계 stepper. 기획 / 운영 양쪽의 substep 을 동시에 노출.
//   - 활성 phase: 진행 바 + 라벨 정상 노출, 진행 정도에 따라 completed/current/pending
//   - 비활성(미래) phase: 그룹 전체 opacity 0.5, 모든 substep disabled
//   - 활성 phase pill: 파랑(info) 톤. 비활성 phase pill: tertiary 회색.
//   - 폰트 weight 400/500. 색상은 Tailwind 변수.

"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  API_PROCESS,
  buildSubstepStatuses,
  isFuturePhase,
  phaseOf,
  type ApiPhaseDef,
  type ApiPhaseId,
  type ApiSubstepDef,
  type ApiSubstepId,
  type StepStatus,
} from "@/lib/apiProcessConfig";

interface Props {
  /** 현재 위치한 substep. phase 는 자동 판단. */
  currentSubstep: ApiSubstepId;
  /** 개별 substep 의 상태를 외부에서 override (예: 운영 단계 내부 진행). */
  substepStatusMap?: Partial<Record<ApiSubstepId, StepStatus>>;
  /** true 면 현재 phase 의 substep 그룹만 노출. (다른 phase 는 phase pill 만 보임) */
  onlyCurrentPhase?: boolean;
}

export function ApiProcessStepper({
  currentSubstep,
  substepStatusMap,
  onlyCurrentPhase,
}: Props) {
  const currentPhase = phaseOf(currentSubstep).id;
  const baseStatuses = buildSubstepStatuses(currentSubstep);
  const statuses: Record<ApiSubstepId, StepStatus> = {
    ...baseStatuses,
    ...substepStatusMap,
  };

  const phasesToRender = onlyCurrentPhase
    ? API_PROCESS.filter((p) => p.id === currentPhase)
    : API_PROCESS;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3.5 dark:border-gray-800 dark:bg-gray-900">
      {/* Phase pill 영역 — 항상 전체 phase pill 노출 */}
      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] text-gray-500 dark:text-gray-400">전체</span>
        {API_PROCESS.map((phase, i) => (
          <span key={phase.id} className="flex items-center gap-2">
            <PhasePill phase={phase} isActive={phase.id === currentPhase} />
            {i < API_PROCESS.length - 1 && (
              <ChevronRight
                size={14}
                aria-hidden="true"
                className="text-gray-400 dark:text-gray-500"
              />
            )}
          </span>
        ))}
      </div>

      {/* substep 그룹 — onlyCurrentPhase 면 현재 phase 만 */}
      <div className="space-y-3.5">
        {phasesToRender.map((phase) => (
          <SubstepGroup
            key={phase.id}
            phase={phase}
            statuses={statuses}
            isFuture={isFuturePhase(phase.id, currentPhase)}
          />
        ))}
      </div>
    </div>
  );
}

function PhasePill({ phase, isActive }: { phase: ApiPhaseDef; isActive: boolean }) {
  if (isActive) {
    return (
      <span
        aria-current="step"
        className="cursor-default rounded-full bg-blue-50 px-2.5 py-0.5 text-[12px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
      >
        {phase.label}
      </span>
    );
  }
  return (
    <span className="cursor-default px-2.5 py-0.5 text-[12px] text-gray-400 dark:text-gray-500">
      {phase.label}
    </span>
  );
}

function SubstepGroup({
  phase,
  statuses,
  isFuture,
}: {
  phase: ApiPhaseDef;
  statuses: Record<ApiSubstepId, StepStatus>;
  isFuture: boolean;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] text-gray-500 dark:text-gray-400">
        {phase.groupLabel}
      </div>
      <div
        className={`grid gap-1.5 ${isFuture ? "opacity-50" : ""}`}
        style={{ gridTemplateColumns: `repeat(${phase.substeps.length}, minmax(0, 1fr))` }}
      >
        {phase.substeps.map((s) => (
          <SubstepCell
            key={s.id}
            substep={s}
            status={isFuture ? "pending" : statuses[s.id]}
            disabled={isFuture}
          />
        ))}
      </div>
    </div>
  );
}

function SubstepCell({
  substep,
  status,
  disabled,
}: {
  substep: ApiSubstepDef;
  status: StepStatus;
  disabled: boolean;
}) {
  const barCls =
    status === "completed"
      ? "bg-[#1D9E75]"
      : status === "current"
      ? "bg-blue-600 dark:bg-blue-400"
      : "bg-gray-200 dark:bg-gray-700";

  const labelCls =
    status === "current"
      ? "font-medium text-blue-700 dark:text-blue-300"
      : status === "completed"
      ? "font-medium text-gray-700 dark:text-gray-300"
      : "text-gray-400 dark:text-gray-500";

  const inner = (
    <>
      <div className={`h-1 rounded-full ${barCls}`} aria-hidden="true" />
      <div className={`mt-1.5 text-center text-[11px] ${labelCls}`}>{substep.label}</div>
    </>
  );

  // 미래 phase 거나 현재 substep 이면 비클릭. 그 외(완료된 substep) 는 Link.
  if (disabled || status === "current") {
    return (
      <div
        aria-current={status === "current" ? "step" : undefined}
        aria-disabled={disabled || undefined}
        className={`-m-1 flex flex-col p-1 ${disabled ? "cursor-not-allowed" : "cursor-default"}`}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={substep.path}
      className="-m-1 flex flex-col rounded-md p-1 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
    >
      {inner}
    </Link>
  );
}
