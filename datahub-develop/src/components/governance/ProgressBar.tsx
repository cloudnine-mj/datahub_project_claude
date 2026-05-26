// 신청서 상세 상단 진행 카드 — 5단계 chevron 탭 + (옵션) 4-cell sub-progress.
//
//   ┌─────────────────────────────────────────────────────────┐
//   │ 전체  1. 신청  >  2. 협의  >  3. 계약  >  4. 진행  >  5. 종료 │
//   │                                                          │
//   │ ██████████  ██████████  ──────────  ──────────              │
//   │ ✓ 담당자 지정   검토 중      보완 요청    승인 완료              │
//   └─────────────────────────────────────────────────────────┘
//
// 상위 5단계 chevron 탭:
//   - 현재 단계만 #D4533E 빨강 + 굵게, 그 외는 회색
//   - 단계 사이 ChevronRight 아이콘
//
// 4-cell sub-progress (currentStage === 0 + subStep prop 전달 시):
//   - 담당자 지정 / 검토 중 / 보완 요청 / 승인 완료 4 cell
//   - done #1D9E75, current #D4533E, current-revision #E08027(보완 요청 cell 활성 시), pending #d1d5db
//
// 5단계 진행 상태(sessionStorage 영속) 헬퍼는 그대로 유지.

"use client";

import { ChevronRight, Check } from "lucide-react";
import { Fragment } from "react";

interface Props {
  stages: string[];
  currentIndex: number;
  /** 신청 단계 내부 sub-step — 'member_assignment' | 'under_review' | 'revision_requested' | 'approved'.
   *  지정 시 4-cell sub-progress 바가 함께 렌더. 미지정 시 chevron 탭만. */
  subStep?: SubStep;
  /** 탭 클릭 시 부모에게 단계 인덱스 전달. 지정 시 chevron 탭이 버튼으로 변해 자유 이동 가능.
   *  Phase 1 개발 편의 — 단계 권한 가드 없이 모든 단계로 직접 이동. */
  onStageClick?: (index: number) => void;
}

export type SubStep =
  | "member_assignment"
  | "under_review"
  | "revision_requested"
  | "approved";

type CellState = "pending" | "current" | "current-revision" | "done";

export function ProgressBar({ stages, currentIndex, subStep, onStageClick }: Props) {
  const safeIndex = Math.max(0, Math.min(currentIndex, stages.length - 1));
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      {/* 상위 chevron 탭 — onStageClick 전달 시 버튼, 미전달 시 단순 텍스트. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <span className="text-gray-400 dark:text-gray-500">전체</span>
        {stages.map((s, i) => {
          const isCurrent = i === safeIndex;
          const labelCls = isCurrent
            ? "font-medium text-[#D4533E]"
            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300";
          return (
            <Fragment key={s}>
              {onStageClick ? (
                <button
                  type="button"
                  onClick={() => onStageClick(i)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`${labelCls} cursor-pointer transition`}
                >
                  {i + 1}. {s}
                </button>
              ) : (
                <span
                  className={
                    isCurrent
                      ? "font-medium text-[#D4533E]"
                      : "text-gray-400 dark:text-gray-500"
                  }
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {i + 1}. {s}
                </span>
              )}
              {i < stages.length - 1 && (
                <ChevronRight
                  size={11}
                  className="text-gray-300 dark:text-gray-600"
                  aria-hidden="true"
                />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* 4-cell sub-progress — 신청 단계(0) + subStep 지정 시. */}
      {subStep && safeIndex === 0 && (
        <div className="mt-4">
          <SubProgress subStep={subStep} />
        </div>
      )}
    </section>
  );
}

function SubProgress({ subStep }: { subStep: SubStep }) {
  // 4 cell 의 상태 계산.
  const memberState: CellState =
    subStep === "member_assignment" ? "current" : "done";
  const reviewState: CellState =
    subStep === "member_assignment"
      ? "pending"
      : subStep === "under_review"
        ? "current"
        : "done";
  const revisionState: CellState =
    subStep === "revision_requested"
      ? "current-revision"
      : subStep === "approved"
        ? "done"
        : "pending";
  const approvedState: CellState =
    subStep === "approved" ? "done" : "pending";

  return (
    <div>
      <div className="mb-2 flex gap-1">
        <Cell state={memberState} />
        <Cell state={reviewState} />
        <Cell state={revisionState} />
        <Cell state={approvedState} />
      </div>
      <div className="flex text-[11px]">
        <Label state={memberState}>담당자 지정</Label>
        <Label state={reviewState}>검토 중</Label>
        <Label state={revisionState}>보완 요청</Label>
        <Label state={approvedState}>승인 완료</Label>
      </div>
    </div>
  );
}

function Cell({ state }: { state: CellState }) {
  const cls =
    state === "done"
      ? "bg-[#1D9E75]"
      : state === "current"
        ? "bg-[#D4533E]"
        : state === "current-revision"
          ? "bg-[#E08027]"
          : "bg-gray-300 dark:bg-gray-700";
  return <div className={`h-2 flex-1 rounded ${cls}`} aria-hidden="true" />;
}

function Label({
  state,
  children,
}: {
  state: CellState;
  children: React.ReactNode;
}) {
  const cls =
    state === "done"
      ? "text-[#1D9E75]"
      : state === "current"
        ? "font-medium text-[#D4533E]"
        : state === "current-revision"
          ? "font-medium text-[#B5610F]"
          : "text-gray-400 dark:text-gray-500";
  return (
    <span className={`flex-1 text-center ${cls}`}>
      {state === "done" && (
        <Check size={10} className="mr-0.5 inline" aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

/** 용역 제작(data_production) 의 5단계. */
export const SERVICE_STAGES = ["신청", "협의", "계약", "진행", "종료"] as const;

/** Phase 1 — 5단계 진행은 form status 와 무관한 별도 상태로 관리.
 *  신청 단계(0) 에서 총괄 담당자가 실무자 지정 후 [협의 단계로] 버튼을 눌러야
 *  1(협의) 로 넘어가는 흐름. 백엔드 컬럼이 없으므로 sessionStorage 에 영속.
 *  status === 'approved' 면 종료(4) 로 고정.
 *
 *  Phase 2 에서 GovernanceForm 에 serviceStage 컬럼 추가 + API 로 교체 예정. */
const STAGE_KEY = (formId: string) => `dh:gov:service-stage:${formId}`;

export function readServiceStage(formId: string, status: string): number {
  if (status === "approved") return 4;
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(STAGE_KEY(formId));
    if (raw == null) return 0;
    const n = Number(raw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(4, n));
  } catch {
    return 0;
  }
}

export function writeServiceStage(formId: string, stage: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STAGE_KEY(formId),
      String(Math.max(0, Math.min(4, stage))),
    );
  } catch {
    /* ignore */
  }
}

/** sub-step 영속 헬퍼 — ApplicationStageTab / ProgressBar 공유. */
const SUBSTEP_KEY = (formId: string) => `dh:gov:stage1:substep:${formId}`;
const SUB_STEPS: readonly SubStep[] = [
  "member_assignment",
  "under_review",
  "revision_requested",
  "approved",
];

export function readSubStep(formId: string): SubStep {
  if (typeof window === "undefined") return "member_assignment";
  try {
    const raw = sessionStorage.getItem(SUBSTEP_KEY(formId));
    if (raw && (SUB_STEPS as readonly string[]).includes(raw))
      return raw as SubStep;
  } catch {
    /* ignore */
  }
  return "member_assignment";
}

export function writeSubStep(formId: string, step: SubStep): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SUBSTEP_KEY(formId), step);
  } catch {
    /* ignore */
  }
}

/** @deprecated readServiceStage 로 대체. */
export function serviceStageIndexFromStatus(status: string): number {
  return status === "approved" ? 4 : 0;
}
