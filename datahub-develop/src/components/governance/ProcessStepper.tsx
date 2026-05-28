// 2층 stepper — 데이터 도입 프로세스 (1. 기획 / 2. 구축 / 3. 적재) + 현재 phase 의 substep.
//   각 항목은 status('done'|'current'|'pending') 와 선택적 path 를 받음.
//     - done + path: Link 로 렌더, 재조회 페이지로 이동
//     - current: 비클릭 span, 활성 스타일 (이미 현재 페이지)
//     - pending: 비클릭 span, 비활성 스타일, tabIndex=-1, aria-disabled
//     - '전체' 라벨: 항상 비클릭 (소속 표시)
//   폰트 weight 는 400/500 만 사용 (font-normal, font-medium).

"use client";

import Link from "next/link";
import { Check } from "lucide-react";

export type StepStatus = "done" | "current" | "pending";

export interface Phase {
  id: string;
  label: string;
  status: StepStatus;
  /** 클릭 시 이동할 경로 — done 이면서 path 가 있을 때만 Link 로 렌더. */
  path?: string;
}

export interface SubStep {
  id: string;
  label: string;
  status: StepStatus;
  path?: string;
}

interface Props {
  phases: Phase[];
  subSteps: SubStep[];
}

export function ProcessStepper({ phases, subSteps }: Props) {
  // phase 가 1개 뿐인 유형(service / subscribe) 은 '전체 / 1.기획' 상단 행이
  // 정보 가치가 없어 숨김. 2개 이상일 때만 노출.
  const showPhaseRow = phases.length > 1;
  // substep 도 1개 뿐이면 단일 칸이라 정보 가치가 없음 — 숨김 (계획 수립 제거
  // 후 요청서 작성 단독). 2개 이상이거나 phase row 가 있을 때만 노출.
  const showSubstepRow = subSteps.length > 1;
  // 둘 다 안 보이면 컨테이너 자체 미렌더 — 빈 카드 사라짐.
  if (!showPhaseRow && !showSubstepRow) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {showPhaseRow && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="cursor-default text-gray-500 dark:text-gray-400">전체</span>
          {phases.map((p, i) => (
            <span key={p.id} className="flex items-center gap-2">
              <PhasePill phase={p} />
              {i < phases.length - 1 && (
                <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">
                  ›
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* 하단 — 현재 phase 의 substep bar + label */}
      {showSubstepRow && (
        <div
          className={(showPhaseRow ? "mt-4 " : "") + "grid gap-2"}
          style={{ gridTemplateColumns: `repeat(${subSteps.length}, minmax(0, 1fr))` }}
        >
          {subSteps.map((s) => (
            <SubStepCell key={s.id} step={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function phasePillStateClass(status: StepStatus): string {
  if (status === "current") {
    return "bg-red-50 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300";
  }
  if (status === "done") {
    return "font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800";
  }
  // pending: 데모 단계라 hover 시각 단서 제공 (path 있을 때 클릭 가능).
  return "text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300";
}

function PhasePill({ phase }: { phase: Phase }) {
  const base = "rounded-full px-3 py-1 transition";
  const state = phasePillStateClass(phase.status);
  const ariaCurrent = phase.status === "current" ? ("step" as const) : undefined;

  // current 가 아니고 path 가 있으면 클릭 가능 (done/pending 모두 허용 — 데모용).
  if (phase.status !== "current" && phase.path) {
    return (
      <Link href={phase.path} className={`${base} ${state} cursor-pointer`}>
        {phase.label}
      </Link>
    );
  }

  return (
    <span
      aria-current={ariaCurrent}
      className={`${base} ${state} cursor-default`}
    >
      {phase.label}
    </span>
  );
}

function SubStepCell({ step }: { step: SubStep }) {
  const isDone = step.status === "done";
  const isCurrent = step.status === "current";
  const isPending = step.status === "pending";

  const barClass = isDone
    ? "bg-[#1D9E75] dark:bg-[#1D9E75]"
    : isCurrent
    ? "bg-brand dark:bg-brand"
    : "bg-gray-200 dark:bg-gray-700";

  const labelClass = isCurrent
    ? "font-medium text-red-700 dark:text-red-300"
    : isDone
    ? "text-gray-700 dark:text-gray-300"
    : "text-gray-400 dark:text-gray-500";

  const inner = (
    <>
      <div className={`h-1 rounded-full ${barClass}`} />
      <div
        className={`mt-2 flex items-center justify-center gap-1 text-xs ${labelClass}`}
      >
        {isDone && <Check size={12} aria-hidden="true" className="text-[#1D9E75]" />}
        <span className="whitespace-nowrap">{step.label}</span>
      </div>
    </>
  );

  // current 가 아니고 path 가 있으면 클릭 가능 (done/pending 모두 허용 — 데모용).
  if (!isCurrent && step.path) {
    return (
      <Link
        href={step.path}
        className="-m-1 flex flex-col rounded-md p-1 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      aria-current={isCurrent ? "step" : undefined}
      className="-m-1 flex cursor-default flex-col p-1"
    >
      {inner}
    </div>
  );
}
