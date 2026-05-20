"use client";

/**
 * 워크플로우 스텝퍼 — 4단계 (제출됨 → 검토 중 → 보완 요청 → 승인 완료)
 *
 * 보완 요청 단계는 '조건부 단계' 라 평소엔 주황 점선으로 표시되고, 보완 요청이
 * 발생한 신청만 채워진 노드로 강조된다. 보완 없이 바로 승인된 건은 흐릿한
 * '건너뜀' 으로 표시.
 *
 * 보완 요청 발생 여부는 approvalHistory 의 action 필드를 보고 판단 — 단순 status
 * 만으로는 '검토 중' 이 'first review' 인지 '재검토' 인지 알 수 없으므로 prop 으로
 * had_revision 을 받는다.
 */

import { AlertCircle, AlertTriangle, Check, Minus } from "lucide-react";
import type { FormStatus } from "@/lib/governance/api-client-full";

type NodeState =
  | "done"         // 파란 ✓
  | "current"      // 파란 채움 + 숫자
  | "upcoming"     // 회색 outline
  | "optional"     // 보완 요청 미발생 — 주황 점선 ! (조건부)
  | "current-amber" // 보완 요청 중 — 주황 채움 !
  | "skipped";     // 보완 없이 승인 — 회색 흐림 –

interface Step {
  index: number;
  label: string;
  sub?: string;
  state: NodeState;
}

interface Props {
  status: FormStatus | string;
  /** 이 신청이 한 번이라도 보완 요청을 거쳤는지 — approvalHistory 에서 action='info_requested' 가 있는지. */
  hadRevision?: boolean;
}

export function WorkflowStepper({ status, hadRevision = false }: Props) {
  const isSubmitted = status === "submitted";
  const isReviewing = status === "reviewing";
  const isInfoRequested = status === "info_requested";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  // 단계 1: 제출됨 — 그 외 모든 상태에서 done.
  const step1State: NodeState = isSubmitted ? "current" : "done";

  // 단계 2: 검토 중 — 현재 reviewing 또는 info_requested 이면 current,
  // approved/rejected 면 done, submitted 면 upcoming.
  let step2State: NodeState;
  if (isReviewing) step2State = "current";
  else if (isInfoRequested) step2State = "done";
  else if (isApproved || isRejected) step2State = "done";
  else step2State = "upcoming";

  // 단계 3: 보완 요청 — 조건부.
  let step3State: NodeState;
  let step3Sub: string | undefined;
  if (isInfoRequested) {
    step3State = "current-amber";
    step3Sub = "재제출 대기";
  } else if (hadRevision) {
    // 이미 한 번 보완 요청을 거쳤다 — done (주황 ✓)
    step3State = "done";
  } else if (isApproved) {
    // 보완 없이 바로 승인 — 건너뜀
    step3State = "skipped";
    step3Sub = "건너뜀";
  } else {
    // 평소 — 조건부 점선
    step3State = "optional";
    step3Sub = "조건부";
  }

  // 단계 4: 승인 완료
  const step4State: NodeState = isApproved || isRejected ? "current" : "upcoming";

  const steps: Step[] = [
    { index: 1, label: "제출됨", state: step1State },
    { index: 2, label: "검토 중", state: step2State },
    { index: 3, label: "보완 요청", sub: step3Sub, state: step3State },
    { index: 4, label: isRejected ? "반려" : "승인 완료", state: step4State },
  ];

  return (
    <div className="mt-4 flex items-start gap-2">
      {steps.map((s, i) => (
        <div key={s.index} className="flex flex-1 items-start">
          <Node step={s} terminal={i === steps.length - 1} terminalRejected={isRejected && i === 3} />
          {i < steps.length - 1 && (
            <Connector
              from={steps[i].state}
              to={steps[i + 1].state}
              throughOptional={i === 2 && steps[2].state === "optional"}
              throughRevision={i === 2 && (steps[2].state === "current-amber" || steps[2].state === "skipped")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Connector({
  from,
  to,
  throughOptional,
  throughRevision,
}: {
  from: NodeState;
  to: NodeState;
  throughOptional: boolean;
  throughRevision: boolean;
}) {
  // 2→3 구간 (보완 요청 단계 전후) — optional 이면 회색 점선, current-amber 이면 주황 점선.
  if (throughOptional) {
    return (
      <div
        aria-hidden="true"
        className="mx-2 mt-3 h-[2px] flex-1"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #d1d5db 0 4px, transparent 4px 8px)",
        }}
      />
    );
  }
  if (throughRevision) {
    return (
      <div
        aria-hidden="true"
        className="mx-2 mt-3 h-[2px] flex-1"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #d97706 0 4px, transparent 4px 8px)",
        }}
      />
    );
  }
  // 일반 구간 — 다음 노드가 활성/완료면 파란색, 그 외 회색.
  const colored = to === "done" || to === "current" || from === "done";
  return (
    <div
      className={"mx-2 mt-3 h-[2px] flex-1 " + (colored ? "bg-blue-500" : "bg-gray-200")}
    />
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
  const { state, index, label, sub } = step;

  let circleCls = "border-gray-200 bg-white text-gray-400";
  let icon: React.ReactNode = index;
  let labelCls = "text-gray-400";
  let subCls = "text-gray-400";

  switch (state) {
    case "done":
      circleCls = "border-blue-500 bg-blue-500 text-white";
      icon = <Check size={14} aria-hidden="true" />;
      labelCls = "text-gray-700";
      break;
    case "current":
      if (terminalRejected) {
        circleCls = "border-red-500 bg-red-500 text-white";
        icon = <AlertTriangle size={14} aria-hidden="true" />;
        labelCls = "text-red-600 font-medium";
      } else if (terminal) {
        circleCls = "border-emerald-500 bg-emerald-500 text-white";
        icon = <Check size={14} aria-hidden="true" />;
        labelCls = "text-emerald-600 font-medium";
      } else {
        circleCls = "border-blue-500 bg-blue-500 text-white";
        labelCls = "text-blue-700 font-medium";
      }
      break;
    case "upcoming":
      circleCls = "border-gray-200 bg-white text-gray-400";
      break;
    case "optional":
      // 흰 배경 + 주황 점선 테두리 + 주황 !
      circleCls = "bg-white text-[#d97706]";
      icon = <AlertCircle size={14} aria-hidden="true" />;
      labelCls = "text-gray-500";
      subCls = "text-gray-400";
      break;
    case "current-amber":
      circleCls = "border-[#d97706] bg-[#d97706] text-white";
      icon = <AlertCircle size={14} aria-hidden="true" />;
      labelCls = "text-[#b45309] font-medium";
      subCls = "text-[#b45309]";
      break;
    case "skipped":
      circleCls = "border-gray-200 bg-gray-100 text-gray-400 opacity-50";
      icon = <Minus size={14} aria-hidden="true" />;
      labelCls = "text-gray-400 opacity-60";
      subCls = "text-gray-400 opacity-60";
      break;
  }

  return (
    <div className="flex flex-col items-center">
      <span
        className={
          "grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-[12px] font-semibold transition " +
          circleCls
        }
        style={
          state === "optional"
            ? { borderColor: "#d97706", borderStyle: "dashed" }
            : undefined
        }
      >
        {icon}
      </span>
      <span className={"mt-1.5 whitespace-nowrap text-[11px] " + labelCls}>{label}</span>
      {sub && (
        <span className={"mt-0.5 whitespace-nowrap text-[10px] " + subCls}>{sub}</span>
      )}
    </div>
  );
}
