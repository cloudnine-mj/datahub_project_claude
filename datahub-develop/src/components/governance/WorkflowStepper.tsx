"use client";

// 워크플로우 스텝퍼 — 첨부 이미지 디자인.
//   ◯ ─── ◯ ─── ◯
//   1     2     3
//  제출됨 검토중 승인완료
//
// 단계별 노드 사이에 라인이 이어져 있고, 활성 단계는 파란 채움 + 흰 숫자.
// 완료된 단계는 ✓ 체크. 다가올 단계는 회색 outline + 회색 숫자.

import { AlertTriangle, Check } from "lucide-react";
import type { FormStatus } from "@/lib/governance/api-client-full";

interface Step {
  index: number;
  label: string;
  status: "done" | "current" | "upcoming";
}

export function WorkflowStepper({ status }: { status: FormStatus | string }) {
  const isApproved = status === "approved";
  const isRejected = status === "rejected";
  const isReviewing = status === "reviewing";
  const isSubmitted = status === "submitted";

  const steps: Step[] = [
    {
      index: 1,
      label: "제출됨",
      status: isSubmitted ? "current" : "done",
    },
    {
      index: 2,
      label: "검토 중",
      status: isReviewing ? "current" : isApproved || isRejected ? "done" : "upcoming",
    },
    {
      index: 3,
      label: isRejected ? "반려" : "승인 완료",
      status: isApproved || isRejected ? "current" : "upcoming",
    },
  ];

  return (
    <div className="mt-4 flex items-start gap-2">
      {steps.map((s, i) => (
        <div key={s.index} className="flex flex-1 items-start">
          <Node step={s} terminal={i === steps.length - 1} terminalRejected={isRejected && i === 2} />
          {i < steps.length - 1 && (
            <div
              className={
                "mx-2 mt-3 h-[2px] flex-1 " +
                (steps[i + 1].status !== "upcoming" ? "bg-blue-500" : "bg-gray-200")
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Node({
  step,
  terminal,
  terminalRejected,
}: {
  step: Step;
  terminal: boolean;
  terminalRejected: boolean;
}) {
  const { status, index, label } = step;
  const current = status === "current";
  const done = status === "done";
  const upcoming = status === "upcoming";

  let circleCls = "border-gray-200 bg-white text-gray-400";
  if (current && terminalRejected) circleCls = "border-red-500 bg-red-500 text-white";
  else if (current && terminal) circleCls = "border-emerald-500 bg-emerald-500 text-white";
  else if (current) circleCls = "border-blue-500 bg-blue-500 text-white";
  else if (done) circleCls = "border-blue-500 bg-blue-500 text-white";

  let labelCls = "text-gray-400";
  if (current && terminalRejected) labelCls = "text-red-600 font-medium";
  else if (current && terminal) labelCls = "text-emerald-600 font-medium";
  else if (current) labelCls = "text-blue-700 font-medium";
  else if (done) labelCls = "text-gray-700";

  return (
    <div className="flex flex-col items-center">
      <span
        className={
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[12px] font-semibold transition " +
          circleCls
        }
      >
        {done ? (
          <Check size={14} aria-hidden="true" />
        ) : current && terminalRejected ? (
          <AlertTriangle size={14} aria-hidden="true" />
        ) : current && terminal ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          index
        )}
      </span>
      <span className={"mt-1.5 whitespace-nowrap text-[11px] " + labelCls}>{label}</span>
      {/* upcoming 상태가 강조되지 않도록 빈 marker — 정렬 일관성 */}
      {upcoming && null}
    </div>
  );
}
