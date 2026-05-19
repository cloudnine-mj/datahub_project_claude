// 3. 적재 단계 — 중앙 저장소 적재 / 메타데이터·데이터카드 작성 / 비용 처리·종료.
//   각 블록의 완료 여부에 따라 ProcessStepper substep 상태가 done/current/pending 으로 갱신.

"use client";

import { useMemo, useState } from "react";
import { PhaseLayout } from "@/components/PhaseLayout";
import type { StepStatus, SubStep } from "@/components/ProcessStepper";
import { DataUploadBlock } from "@/components/phase-load/DataUploadBlock";
import { MetadataDataCardBlock } from "@/components/phase-load/MetadataDataCardBlock";
import {
  SettlementBlock,
  SETTLEMENT_STEPS,
} from "@/components/phase-load/SettlementBlock";
import { useApplicationTypeBreadcrumb } from "@/lib/useApplicationTypeBreadcrumb";

export default function Page() {
  // 블록 1 — 업로드 파일.
  const [file, setFile] = useState<File | null>(null);
  // 블록 2 — 메타데이터/데이터카드 작성 완료 체크.
  const [metadataChecked, setMetadataChecked] = useState(false);
  const [datacardChecked, setDatacardChecked] = useState(false);
  // 블록 3 — 정산 3 항목 체크.
  const [settleChecks, setSettleChecks] = useState<Record<string, boolean>>({});
  const toggleSettle = (id: string) =>
    setSettleChecks((prev) => ({ ...prev, [id]: !prev[id] }));

  // 각 블록의 완료 여부.
  const uploadDone = file !== null;
  const metadataDone = metadataChecked && datacardChecked;
  const settleDone =
    SETTLEMENT_STEPS.length > 0 &&
    SETTLEMENT_STEPS.every((s) => settleChecks[s.id]);

  // ProcessStepper 하단 substep 상태 — 첫 미완료가 current, 그 뒤가 pending.
  const subSteps: SubStep[] = useMemo(() => {
    const dones = [uploadDone, metadataDone, settleDone];
    const labels = ["중앙 저장소 적재", "메타데이터·데이터카드 작성", "비용 처리·종료"];
    const ids = ["upload", "metadata", "settle"];
    let currentAssigned = false;
    return labels.map((label, i) => {
      let status: StepStatus;
      if (dones[i]) {
        status = "done";
      } else if (!currentAssigned) {
        status = "current";
        currentAssigned = true;
      } else {
        status = "pending";
      }
      return { id: ids[i], label, status };
    });
  }, [uploadDone, metadataDone, settleDone]);

  // 모든 블록이 완료되어야 '신청 완료 처리' 버튼 활성. (데모에서는 단순 시각 단서 — 항상 통과시켜도 무방.)
  const canProceed = uploadDone && metadataDone && settleDone;
  const typeCrumb = useApplicationTypeBreadcrumb();

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        typeCrumb,
        { label: "3. 적재" },
      ]}
      phases={[
        { id: "plan", label: "1. 기획", status: "done", path: "/governance/forms/planning" },
        { id: "build", label: "2. 구축", status: "done", path: "/governance/forms/intake/build" },
        { id: "load", label: "3. 적재", status: "current" },
      ]}
      subSteps={subSteps}
      prevPath="/governance/forms/intake/build"
      prevLabel="2단계 다시 보기"
      nextPath="/governance/home"
      nextLabel="신청 완료 처리"
      canProceed={canProceed}
    >
      <DataUploadBlock file={file} onFileChange={setFile} />
      <MetadataDataCardBlock
        metadataChecked={metadataChecked}
        datacardChecked={datacardChecked}
        onToggleMetadata={() => setMetadataChecked((v) => !v)}
        onToggleDatacard={() => setDatacardChecked((v) => !v)}
      />
      <SettlementBlock checked={settleChecks} onToggle={toggleSettle} />
    </PhaseLayout>
  );
}
