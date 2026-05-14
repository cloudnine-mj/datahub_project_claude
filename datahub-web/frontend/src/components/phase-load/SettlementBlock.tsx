// 3단계 / 블록 3 — 비용 처리 및 작업 종료 (담당자 영역, 신청자 읽기 전용).
//   3 row 각각 빈 원 아이콘 + 라벨. 체크박스 아님 — 클릭 비활성.

import { Circle, Receipt } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";

const STEPS: { id: string; label: string }[] = [
  { id: "delivery-confirm", label: "최종 데이터 수령 및 적재 확인" },
  { id: "completion-notify", label: "작업 종료 통보" },
  { id: "cost-process", label: "비용 처리" },
];

export function SettlementBlock() {
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
        {STEPS.map((s) => (
          <li
            key={s.id}
            aria-disabled="true"
            className="flex items-center gap-2.5 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/40"
          >
            <Circle
              size={14}
              aria-hidden="true"
              className="shrink-0 text-gray-300 dark:text-gray-600"
            />
            <span className="text-[13px] text-gray-500 dark:text-gray-400">
              {s.label}
            </span>
          </li>
        ))}
      </ul>
    </PhaseBlock>
  );
}
