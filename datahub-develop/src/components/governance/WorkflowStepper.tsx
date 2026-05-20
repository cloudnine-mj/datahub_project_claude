"use client";

// 워크플로우 스텝퍼 — '제출됨 → 검토 중 → 승인 완료' (반려 시 종착 분기).
// 임시 저장은 stepper 에서 제외 — 제출 후 진행 흐름만 강조.

import { AlertTriangle } from "lucide-react";
import type { FormStatus } from "@/lib/governance/api-client-full";

export function WorkflowStepper({ status }: { status: FormStatus | string }) {
  const reachedSubmitted = ["submitted", "reviewing", "approved", "rejected"].includes(status as string);
  const reachedReviewing = ["reviewing", "approved", "rejected"].includes(status as string);
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const reachedTerminal = isApproved || isRejected;

  return (
    <div className="mt-4 inline-flex items-center gap-3">
      <StepNode label="제출됨" reached={reachedSubmitted} current={status === "submitted"} index={1} />
      <span className={"h-0.5 w-14 " + (reachedReviewing ? "bg-blue-500" : "bg-gray-200")} />

      <StepNode label="검토 중" reached={reachedReviewing} current={status === "reviewing"} index={2} />
      <span className={"h-0.5 w-14 " + (reachedTerminal ? "bg-blue-500" : "bg-gray-200")} />

      <div className="flex flex-col gap-1.5">
        <TerminalNode label="승인 완료" tone="approved" active={isApproved} muted={isRejected} />
        {isRejected && (
          <TerminalNode label="반려" tone="rejected" active={isRejected} muted={isApproved} />
        )}
      </div>
    </div>
  );
}

function DraftNode({ current, passed }: { current: boolean; passed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={
          "grid h-7 w-7 place-items-center rounded-full border-2 border-dashed text-xs font-semibold transition " +
          (current
            ? "border-gray-500 bg-gray-100 text-gray-700"
            : passed
            ? "border-gray-300 bg-gray-50 text-gray-400"
            : "border-gray-300 bg-white text-gray-400")
        }
      >
        {passed ? <Check size={13} /> : "✎"}
      </span>
      <span
        className={
          "mt-1 whitespace-nowrap text-[11px] font-semibold " +
          (current ? "text-gray-800" : passed ? "text-gray-500" : "text-gray-400")
        }
      >
        임시 저장
      </span>
    </div>
  );
}

function StepNode({
  label,
  reached,
  current,
  index,
}: {
  label: string;
  reached: boolean;
  current: boolean;
  index: number;
}) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={
          "grid h-7 w-7 place-items-center rounded-full border text-xs font-semibold transition " +
          (reached
            ? "border-blue-500 bg-blue-500 text-white"
            : "border-gray-200 bg-white text-gray-400")
        }
      >
        {reached && !current ? <Check size={13} /> : index}
      </span>
      <span
        className={
          "mt-1 whitespace-nowrap text-[11px] font-semibold " +
          (current ? "text-blue-700" : reached ? "text-gray-700" : "text-gray-400")
        }
      >
        {label}
      </span>
    </div>
  );
}

function TerminalNode({
  label,
  tone,
  active,
  muted,
}: {
  label: string;
  tone: "approved" | "rejected";
  active: boolean;
  muted: boolean;
}) {
  let dotCls: string;
  let labelCls: string;
  if (active && tone === "approved") {
    dotCls = "border-emerald-500 bg-emerald-500 text-white";
    labelCls = "text-emerald-600";
  } else if (active && tone === "rejected") {
    dotCls = "border-red-500 bg-red-500 text-white";
    labelCls = "text-red-600";
  } else if (muted) {
    dotCls = "border-gray-100 bg-gray-50 text-gray-300";
    labelCls = "text-gray-300";
  } else {
    dotCls = "border-gray-200 bg-white text-gray-400";
    labelCls = "text-gray-400";
  }

  return (
    <div className="flex items-center gap-2">
      <span className={"grid h-6 w-6 place-items-center rounded-full border text-xs font-semibold transition " + dotCls}>
        {active && tone === "approved" && <Check size={12} />}
        {active && tone === "rejected" && <AlertTriangle size={12} />}
      </span>
      <span className={"whitespace-nowrap text-[11px] font-semibold " + labelCls}>{label}</span>
    </div>
  );
}
