// 3단계 / 블록 3 — 비용 처리 및 작업 종료 (담당자 영역).
//   원래는 신청자 읽기 전용이지만, 데모에서는 체크 토글 가능하도록 풀어둠.
//   정식 운영 시 다시 읽기 전용으로 복구 (PhaseChecklistRow 의 onToggle 제거).

"use client";

import { Receipt } from "lucide-react";
import { PhaseBlock } from "@/components/governance/PhaseBlock";
import { PhaseChecklistRow } from "@/components/governance/PhaseChecklistRow";

export const SETTLEMENT_STEPS: { id: string; label: string }[] = [
  { id: "delivery-confirm", label: "최종 데이터 수령 및 적재 확인" },
  { id: "completion-notify", label: "작업 종료 통보" },
  { id: "cost-process", label: "비용 처리" },
];

interface Props {
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function SettlementBlock({ checked, onToggle }: Props) {
  return (
    <PhaseBlock
      icon={Receipt}
      title="비용 처리 및 작업 종료"
      trailing={
        <span className="text-[11px] text-gray-400 dark:text-gray-500">
          담당자 영역
        </span>
      }
    >
      <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
        비용 처리 담당자가 최종 데이터 수령 및 적재를 확인한 후 작업 종료 통보와 비용
        처리를 진행합니다.
      </p>
      <ul className="space-y-1.5">
        {SETTLEMENT_STEPS.map((s) => (
          <li key={s.id}>
            <PhaseChecklistRow
              id={s.id}
              label={s.label}
              checked={!!checked[s.id]}
              onToggle={() => onToggle(s.id)}
            />
          </li>
        ))}
      </ul>
    </PhaseBlock>
  );
}
