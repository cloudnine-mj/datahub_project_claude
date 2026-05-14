// 3. 적재 단계 페이지 — 최종 데이터 적재 / 데이터카드 작성 / 비용 처리·종료.
//   비용 처리 블록은 담당자 영역 — 신청자 화면에서는 진행 상태 안내만 노출.

import { PhaseLayout } from "@/components/PhaseLayout";
import { DatasetUploadBlock } from "@/components/phase-load/DatasetUploadBlock";
import { DataCardBlock } from "@/components/phase-load/DataCardBlock";
import { SettlementBlock } from "@/components/phase-load/SettlementBlock";
import {
  MOCK_DATASET_UPLOAD,
  MOCK_DATA_CARD_FIELDS,
  MOCK_SETTLEMENT_STEPS,
} from "@/lib/phaseMockData";

export default function Page() {
  // 데이터카드 모든 needs-input 필드가 채워졌고 정산 단계 모두 completed 일 때 진행 가능.
  const datacardAllFilled = MOCK_DATA_CARD_FIELDS.every(
    (f) => f.status !== "needs-input",
  );
  const settlementAllDone = MOCK_SETTLEMENT_STEPS.every(
    (s) => s.status === "completed",
  );
  const canProceed = datacardAllFilled && settlementAllDone;

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역 제작/구매/구독", href: "/governance/forms/intake" },
        { label: "3. 적재" },
      ]}
      phases={[
        { id: "plan", label: "1. 기획", status: "done", path: "/governance/forms/intake" },
        {
          id: "build",
          label: "2. 구축",
          status: "done",
          path: "/governance/forms/intake/build",
        },
        { id: "load", label: "3. 적재", status: "current" },
      ]}
      subSteps={[
        { id: "upload", label: "데이터 적재", status: "current" },
        { id: "datacard", label: "데이터카드 작성", status: "pending" },
        { id: "settle", label: "비용 처리·종료", status: "pending" },
      ]}
      prevPath="/governance/forms/intake/build"
      prevLabel="2단계 다시 보기"
      nextLabel="신청 완료 처리"
      canProceed={canProceed}
    >
      <DatasetUploadBlock upload={MOCK_DATASET_UPLOAD} />
      <DataCardBlock fields={MOCK_DATA_CARD_FIELDS} />
      <SettlementBlock
        steps={MOCK_SETTLEMENT_STEPS}
        ownerLabel="담당: 김은솔 (Data Gov.)"
      />
    </PhaseLayout>
  );
}
