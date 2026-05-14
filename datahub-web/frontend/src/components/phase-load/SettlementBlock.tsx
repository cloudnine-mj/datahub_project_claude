// 3단계 / 블록 3 — 비용 처리·작업 종료 체크리스트 (담당자 영역, 읽기 전용).
//   신청자 화면에서는 단순 진행 안내. 하단 안내 박스 노출.

"use client";

import { Circle, Info, Receipt } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";

export interface SettlementStep {
  id: string;
  label: string;
  status: "pending" | "in-progress" | "completed";
  note: string;
}

interface Props {
  steps: SettlementStep[];
  /** 담당자 표기 — 헤더 우측. */
  ownerLabel?: string;
  /** 하단 안내 박스 노출 여부. */
  showHint?: boolean;
}

export function SettlementBlock({ steps, ownerLabel, showHint = true }: Props) {
  return (
    <PhaseBlock
      icon={Receipt}
      title="비용 처리·작업 종료"
      trailing={
        ownerLabel ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">{ownerLabel}</span>
        ) : undefined
      }
    >
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.id}>
            <StepRow step={s} />
          </li>
        ))}
      </ul>
      {showHint && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-200">
          <Info size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>데이터카드 작성이 완료되면 담당자가 위 4단계를 순차적으로 처리합니다.</p>
        </div>
      )}
    </PhaseBlock>
  );
}

function StepRow({ step }: { step: SettlementStep }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/40">
      <Circle size={14} aria-hidden="true" className="text-gray-300 dark:text-gray-600" />
      <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{step.label}</span>
      <span className="text-[11px] text-gray-400 dark:text-gray-500">{step.note}</span>
    </div>
  );
}
