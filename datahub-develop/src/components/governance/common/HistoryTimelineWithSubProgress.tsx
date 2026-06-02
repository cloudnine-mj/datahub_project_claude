// 협의·계약 단계용 진행 이력 카드 — 신청 단계의 가로 타임라인 대신 현재 단계의 3단계
//   진척(협의 진행 중 / 계약 진행 / 진행 단계 진입) 을 가로로 통합 표시.
//   별도의 "현재 단계 진척" 카드를 만들지 않고 이 카드 하나로 통합.

"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, History } from "lucide-react";
import {
  readContractStatus,
  readNegotiationStatus,
} from "@/lib/governance/stage-status";

export type SubStep = "negotiation" | "contract" | "advance";

export type SubStepState = "done" | "current" | "upcoming";

interface SubStepView {
  key: SubStep;
  label: string;
  number: number;
}

const STEPS: readonly SubStepView[] = [
  { key: "negotiation", label: "협의 진행 중", number: 1 },
  { key: "contract", label: "계약 진행", number: 2 },
  { key: "advance", label: "진행 단계 진입", number: 3 },
];

interface Props {
  /** 현재 신청서 id — stage-status sessionStorage 키 생성용. */
  formId: string;
}

/** 협의/계약 완료 상태로 3단계의 상태(done/current/upcoming) 와 진행 중 라벨을 결정. */
function deriveStates(
  negotiationDone: boolean,
  contractDone: boolean,
): { states: Record<SubStep, SubStepState>; runningLabels: Record<SubStep, string> } {
  // 기본 라벨 — 진행 중일 때만 별도 표기.
  const runningLabels: Record<SubStep, string> = {
    negotiation: "협의 진행 중",
    contract: "계약 진행 중",
    advance: "진행 단계 진입",
  };
  const states: Record<SubStep, SubStepState> = {
    negotiation: "current",
    contract: "upcoming",
    advance: "upcoming",
  };
  if (negotiationDone) {
    states.negotiation = "done";
    states.contract = "current";
  }
  if (contractDone) {
    states.contract = "done";
    states.advance = "current";
  }
  return { states, runningLabels };
}

export function HistoryTimelineWithSubProgress({ formId }: Props) {
  // 협의·계약 완료 여부 — sessionStorage 에서 읽고, 변경 이벤트 수신 시 즉시 재로드.
  const [negotiationDone, setNegotiationDone] = useState(false);
  const [contractDone, setContractDone] = useState(false);

  useEffect(() => {
    function refresh(): void {
      setNegotiationDone(readNegotiationStatus(formId).isCompleted);
      setContractDone(readContractStatus(formId).isCompleted);
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

  const { states, runningLabels } = deriveStates(negotiationDone, contractDone);

  return (
    <section
      className="rounded-[11px] border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[15px] py-[13px] dark:border-gray-700 dark:bg-gray-900"
    >
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
          현재: 협의 및 계약
        </span>
      </header>

      <div className="flex items-center gap-[6px]">
        {STEPS.map((step, idx) => {
          const st = states[step.key];
          const labelText = st === "current" ? runningLabels[step.key] : step.label;
          return (
            <Fragment key={step.key}>
              <StepDot step={step} state={st} runningLabel={labelText} />
              {idx < STEPS.length - 1 && (
                <Connector
                  left={states[step.key]}
                  right={states[STEPS[idx + 1].key]}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function StepDot({
  step,
  state,
  runningLabel,
}: {
  step: SubStepView;
  state: SubStepState;
  runningLabel: string;
}) {
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
  const labelText = isDone
    ? step.key === "negotiation"
      ? "협의 완료"
      : step.key === "contract"
        ? "계약 완료"
        : "진행 단계 진입"
    : runningLabel;

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
  // 색상 결정:
  //   양쪽 모두 done → #1D9E75
  //   왼쪽 done + 오른쪽 current → #D4533E (다음 단계가 활성으로 진입한 구간 강조)
  //   그 외 → tertiary 회색
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
