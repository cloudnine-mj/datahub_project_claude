// 2. 구축 단계 페이지 — 계약 체결 / 중간 수령·검수 / 검수 피드백.
//   intake(1단계) 이후 진입. 신청자 시점 (검수 액션·코멘트 가능).

import { PhaseLayout } from "@/components/PhaseLayout";
import { ContractStatusBlock } from "@/components/phase-build/ContractStatusBlock";
import { DeliveryRoundsBlock } from "@/components/phase-build/DeliveryRoundsBlock";
import { InspectionFeedbackBlock } from "@/components/phase-build/InspectionFeedbackBlock";
import {
  MOCK_CONTRACT,
  MOCK_DELIVERY_ROUNDS,
  MOCK_FEEDBACK,
} from "@/lib/phaseMockData";

export default function Page() {
  const inProgress = MOCK_DELIVERY_ROUNDS.find((r) => r.status === "in-progress");
  const trailingLabel = inProgress
    ? `${inProgress.roundNumber}/${MOCK_CONTRACT.totalRounds}회차 진행 중`
    : undefined;

  // canProceed: 최종 회차까지 모두 completed 일 때만 true.
  const allCompleted = MOCK_DELIVERY_ROUNDS.every((r) => r.status === "completed");

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역 제작/구매/구독", href: "/governance/forms/intake" },
        { label: "2. 구축" },
      ]}
      phases={[
        { id: "plan", label: "1. 기획", status: "done", path: "/governance/forms/intake" },
        { id: "build", label: "2. 구축", status: "current" },
        { id: "load", label: "3. 적재", status: "pending" },
      ]}
      subSteps={[
        { id: "contract", label: "계약 체결", status: "done" },
        { id: "delivery", label: "중간 수령·검수", status: "current" },
        { id: "final", label: "최종 수령", status: "pending" },
      ]}
      prevPath="/governance/forms/intake"
      prevLabel="1단계 다시 보기"
      nextPath="/governance/forms/intake/load"
      nextLabel="최종 데이터 수령 확인"
      canProceed={allCompleted}
    >
      <ContractStatusBlock contract={MOCK_CONTRACT} />
      <DeliveryRoundsBlock
        rounds={MOCK_DELIVERY_ROUNDS}
        trailingLabel={trailingLabel}
      />
      <InspectionFeedbackBlock feedbacks={MOCK_FEEDBACK} />
    </PhaseLayout>
  );
}
