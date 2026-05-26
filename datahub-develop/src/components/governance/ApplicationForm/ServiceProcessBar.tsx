// 데이터 용역 제작 신청서 전용 5단계 프로세스바 — 신청→협의→계약→진행→종료.
//
// 원형 노드(28px) + 라벨, 노드 사이 2px 연결선.
//   완료: #1D9E75 배경 + 흰색 check 아이콘
//   현재: #D4533E 배경 + 흰색 숫자, 라벨 brand 굵게
//   예정: 회색 배경 + tertiary 숫자, 라벨 tertiary
//
// 현재 단계는 신청서 status 로부터 결정:
//   draft                 → 1. 신청
//   submitted / reviewing / info_requested → 2. 협의 (협의·계약·진행 분기는 Phase 2)
//   approved              → 5. 종료
//
// Phase 1: UI 만. 2~5 단계 실제 페이지·기능은 후속 작업.

"use client";

import { Check } from "lucide-react";

type StepIndex = 0 | 1 | 2 | 3 | 4;

const STEPS = ["신청", "협의", "계약", "진행", "종료"] as const;

interface Props {
  /** form status 또는 명시적 단계 인덱스. */
  status?: string;
  /** status 무시하고 직접 지정하고 싶을 때. */
  currentStep?: StepIndex;
}

function deriveCurrent(status: string | undefined): StepIndex {
  switch (status) {
    case "draft":
      return 0;
    case "submitted":
    case "reviewing":
    case "info_requested":
      return 1;
    case "approved":
      return 4;
    default:
      return 0;
  }
}

export function ServiceProcessBar({ status, currentStep }: Props) {
  const current: StepIndex = currentStep ?? deriveCurrent(status);

  return (
    <div className="rounded-lg bg-gray-50 px-4 py-4 dark:bg-gray-800/40">
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const isLast = i === STEPS.length - 1;
          const state: "done" | "current" | "pending" =
            i < current ? "done" : i === current ? "current" : "pending";
          return (
            <div key={label} className="flex flex-1 items-center first:flex-initial">
              <Node index={i} label={label} state={state} />
              {!isLast && <Connector done={i < current} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Node({
  index,
  label,
  state,
}: {
  index: number;
  label: string;
  state: "done" | "current" | "pending";
}) {
  const bg =
    state === "done"
      ? "bg-[#1D9E75]"
      : state === "current"
        ? "bg-[#D4533E]"
        : "bg-gray-200 dark:bg-gray-700";
  const text =
    state === "pending"
      ? "text-gray-400 dark:text-gray-500"
      : "text-white";
  const labelCls =
    state === "current"
      ? "font-medium text-[#D4533E]"
      : state === "done"
        ? "text-gray-700 dark:text-gray-200"
        : "text-gray-400 dark:text-gray-500";
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        aria-current={state === "current" ? "step" : undefined}
        className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] ${bg} ${text}`}
      >
        {state === "done" ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : index + 1}
      </div>
      <span className={`text-[12px] ${labelCls}`}>{label}</span>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`mx-2 h-0.5 flex-1 ${done ? "bg-[#1D9E75]" : "bg-gray-200 dark:bg-gray-700"}`}
      style={{ marginBottom: "26px" }}
    />
  );
}
