// 신청서 상세 상단 진행 카드 — 막대 채우기형(스타일 B).
//
//   ┌────────────────────────────────────────────────────────┐
//   │ 진행 상태                              신청 단계 · 1/5    │
//   │                                                         │
//   │ ████ ──── ──── ──── ────                                 │
//   │ 신청    협의    계약    진행    종료                       │
//   └────────────────────────────────────────────────────────┘
//
// 라벨 색:
//   완료(index < current): #1D9E75 녹색
//   현재(index === current): #D4533E 빨강 + weight 500
//   예정(index > current): text-gray-500 (secondary)
//
// 막대 색:
//   완료 #1D9E75 / 현재 #D4533E / 예정 회색
//
// onStageClick prop 전달 시 라벨이 버튼으로 변해 자유 이동.

"use client";

import { Fragment } from "react";

interface Props {
  stages: string[];
  currentIndex: number;
  /** 라벨 클릭 시 부모에게 단계 인덱스 전달. Phase 1 개발 편의 — 권한 가드 없이 자유 이동. */
  onStageClick?: (index: number) => void;
}

function segmentClass(index: number, current: number): string {
  if (index < current) return "bg-[#1D9E75]";
  if (index === current) return "bg-[#D4533E]";
  return "bg-gray-200 dark:bg-gray-700";
}

function labelColorClass(index: number, current: number): string {
  if (index < current) return "text-[#1D9E75]";
  if (index === current) return "font-medium text-[#D4533E]";
  return "text-gray-500 dark:text-gray-400";
}

export function ProgressBar({ stages, currentIndex, onStageClick }: Props) {
  const safeIndex = Math.max(0, Math.min(currentIndex, stages.length - 1));
  const currentName = stages[safeIndex] ?? "";
  return (
    <section className="rounded-xl border border-gray-200 bg-white px-6 py-5 dark:border-gray-700 dark:bg-gray-900">
      {/* 헤더 — '진행 상태' 제목 + 우측 'n/5' 위치 표시 */}
      <header className="mb-4 flex items-center justify-between">
        <span className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
          진행 상태
        </span>
        <span className="text-[13px] font-medium text-[#D4533E]">
          {currentName} 단계 · {safeIndex + 1}/{stages.length}
        </span>
      </header>

      {/* 막대 — 5 cell flex-1, gap 5px, height 9px */}
      <div className="mb-3 flex gap-[5px]">
        {stages.map((s, i) => (
          <div
            key={s}
            className={`h-[9px] flex-1 rounded-[5px] ${segmentClass(i, safeIndex)}`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* 라벨 — onStageClick 전달 시 버튼으로, 미전달 시 텍스트 */}
      <div className="flex text-[14px]">
        {stages.map((s, i) => {
          const isCurrent = i === safeIndex;
          const colorCls = labelColorClass(i, safeIndex);
          return (
            <Fragment key={s}>
              {onStageClick ? (
                <button
                  type="button"
                  onClick={() => onStageClick(i)}
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex-1 text-center transition ${colorCls} hover:underline`}
                >
                  {s}
                </button>
              ) : (
                <span
                  className={`flex-1 text-center ${colorCls}`}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  {s}
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
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

/** sub-step 영속 헬퍼 — ApplicationStageTab 가 사용. */
export type SubStep =
  | "member_assignment"
  | "under_review"
  | "approval_requested"
  | "revision_requested"
  | "approved";

const SUBSTEP_KEY = (formId: string) => `dh:gov:stage1:substep:${formId}`;
const SUB_STEPS: readonly SubStep[] = [
  "member_assignment",
  "under_review",
  "approval_requested",
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
