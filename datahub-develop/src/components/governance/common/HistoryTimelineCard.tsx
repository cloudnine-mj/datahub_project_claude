// 진행 이력 카드(통일) — 서비스 큰 4단계(요청서 검토/협의 및 계약/진행/종료)를
//   가로 타임라인으로 표시. 완료 단계엔 완료일, 현재 단계엔 '진행 중', 예정엔 '-'.
//   서브 진척(중간/수정/최종 납품 등)은 표시하지 않는다.

"use client";

import { Fragment, useEffect, useState } from "react";
import { Check, History } from "lucide-react";
import {
  ensureCompletedUpTo,
  readStageState,
  SERVICE_STAGE_KEYS,
  type StageState,
} from "@/lib/governance/stage-state";

interface Props {
  formId: string;
  /** 현재 단계 인덱스 0~3 (0 요청서 검토 / 1 협의 및 계약 / 2 진행 / 3 종료). */
  currentIndex: number;
}

const STEPS: readonly { label: string; number: number }[] = [
  { label: "요청서 검토", number: 1 },
  { label: "협의 및 계약", number: 2 },
  { label: "진행", number: 3 },
  { label: "종료", number: 4 },
];

export function HistoryTimelineCard({ formId, currentIndex }: Props) {
  const [state, setState] = useState<StageState>({ completedAt: {} });

  useEffect(() => {
    // 현재 단계 이전 단계 완료일을 없으면 백필 후 로드.
    ensureCompletedUpTo(formId, currentIndex);
    const refresh = () => setState(readStageState(formId));
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [formId, currentIndex]);

  const currentLabel = STEPS[currentIndex]?.label ?? "진행";

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
        {STEPS.map((step, idx) => {
          const stageKey = SERVICE_STAGE_KEYS[idx];
          const completedAt = stageKey ? state.completedAt[stageKey] : undefined;
          const phase =
            idx < currentIndex ? "done" : idx === currentIndex ? "current" : "upcoming";
          return (
            <Fragment key={step.label}>
              <StepDot step={step} phase={phase} completedAt={completedAt} />
              {idx < STEPS.length - 1 && (
                <Connector
                  done={idx < currentIndex && idx + 1 <= currentIndex}
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
  phase,
  completedAt,
}: {
  step: { label: string; number: number };
  phase: "done" | "current" | "upcoming";
  completedAt?: string;
}) {
  const isDone = phase === "done";
  const isCurrent = phase === "current";
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
  const meta = isDone ? completedAt ?? "" : isCurrent ? "진행 중" : "-";

  return (
    <div className="flex items-center gap-1.5">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
        style={dotStyle}
        aria-hidden="true"
      >
        {isDone ? <Check size={13} /> : step.number}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[11px]" style={labelStyle}>
          {step.label}
        </span>
        <span
          className="text-[9px] text-[var(--color-text-tertiary,#9ca3af)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {meta}
        </span>
      </div>
    </div>
  );
}

function Connector({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="h-px w-[40px] shrink-0"
      style={{ background: done ? "#1D9E75" : "var(--color-border-tertiary,#e5e7eb)" }}
    />
  );
}
