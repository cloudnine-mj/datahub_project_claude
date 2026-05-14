// 2. 구축 단계 — 계약 체결 확인 / 중간 수령·검수·피드백 / 최종 데이터 수령.
//   원본 거버넌스 가이드라인 명세대로 간결한 구조. 회차/금액 등 디테일은 포함하지 않음.

"use client";

import { useState } from "react";
import { PhaseLayout } from "@/components/PhaseLayout";
import { ContractConfirmBlock } from "@/components/phase-build/ContractConfirmBlock";
import { IntermediateDeliveryBlock } from "@/components/phase-build/IntermediateDeliveryBlock";
import { FinalDeliveryBlock } from "@/components/phase-build/FinalDeliveryBlock";

export default function Page() {
  const [finalReceived, setFinalReceived] = useState(false);

  // TODO: 원래 조건 — 최종 데이터 수령 확인 시점에 true. 데모용으로 항상 진입 허용.
  const canProceed = true;

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
        { label: "2. 구축" },
      ]}
      phases={[
        {
          id: "plan",
          label: "1. 기획",
          status: "done",
          path: "/governance/forms/planning",
        },
        { id: "build", label: "2. 구축", status: "current" },
        { id: "load", label: "3. 적재", status: "pending" },
      ]}
      subSteps={[
        { id: "contract", label: "계약 체결", status: "current" },
        { id: "delivery", label: "중간 수령·검수·피드백", status: "pending" },
        { id: "final", label: "최종 수령", status: "pending" },
      ]}
      prevPath="/governance/forms/planning"
      prevLabel="1단계 다시 보기"
      nextPath="/governance/forms/intake/load"
      nextLabel="3단계로 진행"
      canProceed={canProceed}
    >
      <ContractConfirmBlock />
      <IntermediateDeliveryBlock />
      <FinalDeliveryBlock
        checked={finalReceived}
        onToggle={() => setFinalReceived((v) => !v)}
      />
    </PhaseLayout>
  );
}
