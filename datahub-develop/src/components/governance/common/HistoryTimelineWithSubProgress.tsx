// 진행 이력 카드 — 현재 단계의 sub-step 진척을 가로로 통합 표시.
//   협의·계약 단계: 3단계(협의 진행 / 계약 진행 / 진행 단계 진입)
//
// 변경 이벤트(dh:gov:stage-status-changed) 수신 시 즉시 재로드.

"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, History } from "lucide-react";
import {
  readContractStatus,
  readNegotiationStatus,
} from "@/lib/governance/stage-status";

export type SubStepState = "done" | "current" | "upcoming";

interface StepView {
  key: string;
  /** 평소(예정/진행 중) 라벨 — 'done' 상태가 되면 doneLabel 로 교체. */
  label: string;
  doneLabel: string;
  number: number;
}

interface Props {
  formId: string;
  /** 협의·계약 단계용 3단계. */
  variant: "negotiation-contract";
}

const NC_STEPS: readonly StepView[] = [
  { key: "negotiation", label: "협의 진행 중", doneLabel: "협의 완료", number: 1 },
  { key: "contract", label: "계약 진행", doneLabel: "계약 완료", number: 2 },
  { key: "advance", label: "진행 단계 진입", doneLabel: "진행 단계 진입", number: 3 },
];

function useNegotiationContractStates(formId: string): SubStepState[] {
  const [s, setS] = useState<SubStepState[]>(["current", "upcoming", "upcoming"]);
  useEffect(() => {
    function refresh(): void {
      const negDone = readNegotiationStatus(formId).isCompleted;
      const conDone = readContractStatus(formId).isCompleted;
      const next: SubStepState[] = ["current", "upcoming", "upcoming"];
      if (negDone) {
        next[0] = "done";
        next[1] = "current";
      }
      if (conDone) {
        next[1] = "done";
        next[2] = "current";
      }
      setS(next);
    }
    refresh();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ formId?: string }>).detail;
      if (!detail || detail.formId === formId) refresh();
    };
    window.addEventListener("dh:gov:stage-status-changed", onChange);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("dh:gov:stage-status-changed", onChange);
      window.removeEventListener("focus", refresh);
    };
  }, [formId]);
  return s;
}

export function HistoryTimelineWithSubProgress({ formId }: Props) {
  const states = useNegotiationContractStates(formId);
  const steps = NC_STEPS;
  const currentLabel = "협의 및 계약";

  return (
    <section className="rounded-[11px] border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[15px] py-[13px] dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-1.5">
        <History
          size={13}
          aria-hidden="true"
          className="text-[var(--color-text-secondary,#6b7280)]"
        />
        <span className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
          진행 이력
        </span>
        <span
          className="ml-auto inline-flex items-center text-[9px]"
          style={{
            color: "var(--color-text-secondary,#6b7280)",
            background: "var(--color-background-secondary,#f3f4f6)",
            borderRadius: 5,
            padding: "1px 6px",
          }}
        >
          현재: {currentLabel}
        </span>
      </header>

      <div className="flex items-center gap-[6px]">
        {steps.map((step, idx) => (
          <Fragment key={step.key}>
            <StepDot step={step} state={states[idx]} />
            {idx < steps.length - 1 && (
              <Connector left={states[idx]} right={states[idx + 1]} />
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

function StepDot({ step, state }: { step: StepView; state: SubStepState }) {
  const isDone = state === "done";
  const isCurrent = state === "current";
  const dotStyle = isDone
    ? { background: "#1D9E75", color: "#fff" }
    : isCurrent
      ? { background: "#D4533E", color: "#fff" }
      : {
          background: "var(--color-background-secondary,#f3f4f6)",
          color: "var(--color-text-secondary,#6b7280)",
        };
  const labelStyle = isDone
    ? { color: "#0F6E56" }
    : isCurrent
      ? { color: "#D4533E", fontWeight: 500 as const }
      : { color: "var(--color-text-secondary,#6b7280)", opacity: 0.5 };
  const labelText = isDone ? step.doneLabel : step.label;

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-medium"
        style={dotStyle}
        aria-hidden="true"
      >
        {isDone ? <Check size={11} /> : step.number}
      </span>
      <span className="text-[11px]" style={labelStyle}>
        {labelText}
      </span>
    </div>
  );
}

function Connector({ left, right }: { left: SubStepState; right: SubStepState }) {
  let color = "var(--color-border-tertiary,#e5e7eb)";
  if (left === "done" && right === "done") color = "#1D9E75";
  else if (left === "done" && right === "current") color = "#D4533E";
  return (
    <span
      aria-hidden="true"
      className="h-px w-[25px] shrink-0"
      style={{ background: color }}
    />
  );
}
