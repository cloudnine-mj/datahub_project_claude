// 1. 기획 / substep 4: 결재 승인 확인.
//   G Portal 외부 진행 후 승인 결과를 요청자가 직접 확인하는 단순 체크 화면.

"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { PhaseLayout } from "@/components/governance/PhaseLayout";
import { PhaseBlock } from "@/components/governance/PhaseBlock";
import { PhaseChecklistRow } from "@/components/governance/PhaseChecklistRow";
import {
  buildPhase1SubSteps,
  getPhase1Phases,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/governance/forms/phase1-substeps";
import { useApplicationTypeBreadcrumb } from "@/lib/governance/forms/use-application-type-breadcrumb";
import { usePlanningType } from "@/lib/governance/forms/use-planning-type";

export default function Page() {
  const [confirmed, setConfirmed] = useState(false);
  const type = usePlanningType();
  const prev = prevPhase1Substep("approval-check", type);
  const next = nextPhase1Substep("approval-check", type);
  const typeCrumb = useApplicationTypeBreadcrumb();

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        typeCrumb,
        { label: "결재 승인 확인" },
      ]}
      phases={getPhase1Phases(type)}
      subSteps={buildPhase1SubSteps("approval-check", type)}
      prevPath={prev?.path}
      prevLabel={prev ? `${prev.label} 다시 보기` : undefined}
      nextPath={next.path}
      nextLabel={next.label}
    >
      <PhaseBlock icon={CheckCircle2} title="결재 승인 확인">
        <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          G Portal 전자결재에서 결재가 승인되었는지 확인하세요.
        </p>
        <PhaseChecklistRow
          id="approval-confirmed"
          label="결재 승인 확인"
          checked={confirmed}
          onToggle={() => setConfirmed((v) => !v)}
        />
      </PhaseBlock>
    </PhaseLayout>
  );
}
