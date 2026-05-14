// 3. 적재 단계 — 중앙 저장소 적재 / 메타데이터·데이터카드 작성 / 비용 처리·종료.
//   비용 처리 블록은 담당자 영역 — 신청자 화면에서 읽기 전용.

"use client";

import { useState } from "react";
import { PhaseLayout } from "@/components/PhaseLayout";
import { DataUploadBlock } from "@/components/phase-load/DataUploadBlock";
import { MetadataDataCardBlock } from "@/components/phase-load/MetadataDataCardBlock";
import { SettlementBlock } from "@/components/phase-load/SettlementBlock";

export default function Page() {
  const [metadataChecked, setMetadataChecked] = useState(false);
  const [datacardChecked, setDatacardChecked] = useState(false);

  // TODO: 원래 조건 — 메타데이터 + 데이터카드 모두 작성 완료 + 담당자 정산 완료.
  // 데모 단계에서는 신청 완료 처리 버튼을 항상 열어둠.
  const canProceed = true;

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
        { label: "3. 적재" },
      ]}
      phases={[
        {
          id: "plan",
          label: "1. 기획",
          status: "done",
          path: "/governance/forms/planning",
        },
        {
          id: "build",
          label: "2. 구축",
          status: "done",
          path: "/governance/forms/intake/build",
        },
        { id: "load", label: "3. 적재", status: "current" },
      ]}
      subSteps={[
        { id: "upload", label: "중앙 저장소 적재", status: "current" },
        { id: "metadata", label: "메타데이터·데이터카드 작성", status: "pending" },
        { id: "settle", label: "비용 처리·종료", status: "pending" },
      ]}
      prevPath="/governance/forms/intake/build"
      prevLabel="2단계 다시 보기"
      nextPath="/governance/home"
      nextLabel="신청 완료 처리"
      canProceed={canProceed}
    >
      <DataUploadBlock />
      <MetadataDataCardBlock
        metadataChecked={metadataChecked}
        datacardChecked={datacardChecked}
        onToggleMetadata={() => setMetadataChecked((v) => !v)}
        onToggleDatacard={() => setDatacardChecked((v) => !v)}
      />
      <SettlementBlock />
    </PhaseLayout>
  );
}
