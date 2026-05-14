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

const PENDING_TITLE = "아직 접근할 수 없는 단계입니다";

export function ProcessStepper({ phases, subSteps }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* 상단 — phase */}
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

      {/* 하단 — 현재 phase 의 substep bar + label */}
      {subSteps.length > 0 && (
        <div
          className="mt-4 grid gap-2"
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
  return "text-gray-400 dark:text-gray-500";
}

function PhasePill({ phase }: { phase: Phase }) {
  const base = "rounded-full px-3 py-1 transition";
  const state = phasePillStateClass(phase.status);
  const ariaCurrent = phase.status === "current" ? ("step" as const) : undefined;

  if (phase.status === "done" && phase.path) {
    return (
      <Link href={phase.path} className={`${base} ${state} cursor-pointer`}>
        {phase.label}
      </Link>
    );
  }

  const isPending = phase.status === "pending";
  return (
    <span
      aria-current={ariaCurrent}
      aria-disabled={isPending ? true : undefined}
      title={isPending ? PENDING_TITLE : undefined}
      tabIndex={isPending ? -1 : undefined}
      className={`${base} ${state} ${
        isPending ? "cursor-not-allowed" : "cursor-default"
      }`}
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

  // done + path: 클릭 가능 — Link 로 렌더
  if (isDone && step.path) {
    return (
      <Link
        href={step.path}
        className="-m-1 flex flex-col rounded-md p-1 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
      >
        {inner}
      </Link>
    );
  }

  // 그 외(done-without-path / current / pending): 비클릭 span 으로 처리
  return (
    <div
      aria-current={isCurrent ? "step" : undefined}
      aria-disabled={isPending ? true : undefined}
      title={isPending ? PENDING_TITLE : undefined}
      tabIndex={isPending ? -1 : undefined}
      className={`-m-1 flex flex-col p-1 ${
        isPending ? "cursor-not-allowed" : "cursor-default"
      }`}
    >
      {inner}
    </div>
  );
}
