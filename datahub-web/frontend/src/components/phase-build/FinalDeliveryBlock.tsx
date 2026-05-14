// 2단계 / 블록 3 — 최종 데이터 수령 확인 (체크박스 1개).
//   체크 시 3단계 적재 진행 가능 — 페이지에서 canProceed 로 활용.

"use client";

import { CheckCircle2 } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseChecklistRow } from "@/components/PhaseChecklistRow";

interface Props {
  checked: boolean;
  onToggle: () => void;
}

export function FinalDeliveryBlock({ checked, onToggle }: Props) {
  return (
    <PhaseBlock icon={CheckCircle2} title="최종 데이터 수령">
      <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
        최종 데이터 수령을 확인하면 3단계 적재로 진행할 수 있습니다.
      </p>
      <PhaseChecklistRow
        id="final-received"
        label="최종 데이터를 수령했다"
        checked={checked}
        onToggle={onToggle}
      />
    </PhaseBlock>
  );
}
