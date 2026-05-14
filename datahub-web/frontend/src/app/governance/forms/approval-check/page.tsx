// 1. 기획 / substep 4: 결재 승인 확인.
//   g portal 외부 진행 후 승인 결과를 신청자가 직접 확인하는 단순 체크 화면.

"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { PhaseLayout } from "@/components/PhaseLayout";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseChecklistRow } from "@/components/PhaseChecklistRow";
import {
  PHASE1_PHASES,
  buildPhase1SubSteps,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/phase1Substeps";

export default function Page() {
  const [confirmed, setConfirmed] = useState(false);
  const prev = prevPhase1Substep("approval-check");
  const next = nextPhase1Substep("approval-check");

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
        { label: "1. 기획 · 결재 승인 확인" },
      ]}
      phases={PHASE1_PHASES}
      subSteps={buildPhase1SubSteps("approval-check")}
      prevPath={prev?.path}
      prevLabel={prev ? `${prev.label} 다시 보기` : undefined}
      nextPath={next.path}
      nextLabel={next.label}
    >
      <PhaseBlock icon={CheckCircle2} title="결재 승인 확인">
        <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          g portal 전자결재에서 결재가 승인되었는지 확인하세요.
        </p>
        <PhaseChecklistRow
          id="approval-confirmed"
          label="결재가 승인되었음을 확인했다"
          checked={confirmed}
          onToggle={() => setConfirmed((v) => !v)}
        />
      </PhaseBlock>
    </PhaseLayout>
  );
}
