// 1. 기획 / substep 2: 신청서 작성.
//   3개 유형 카드(용역 제작 / 구매 / 구독) 중 선택해 FormBuilder 로 진입.
//   양식 자체는 기존 FormBuilder 가 처리 — 여기서는 유형 선택만 담당.

"use client";

import { useRouter } from "next/navigation";
import { PhaseLayout } from "@/components/PhaseLayout";
import { HelpBanner } from "@/components/HelpBanner";
import { ApplicationTypeCard } from "@/components/ApplicationTypeCard";
import { APPLICATION_TYPES } from "@/lib/applicationTypes";
import {
  PHASE1_PHASES,
  buildPhase1SubSteps,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/phase1Substeps";

export default function Page() {
  const router = useRouter();
  const prev = prevPhase1Substep("form");
  const next = nextPhase1Substep("form");

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
        { label: "1. 기획 · 신청서 작성" },
      ]}
      phases={PHASE1_PHASES}
      subSteps={buildPhase1SubSteps("form")}
      prevPath={prev?.path}
      prevLabel={prev ? `${prev.label} 다시 보기` : undefined}
      nextPath={next.path}
      nextLabel="신청서 제출"
    >
      <HelpBanner message="신청서는 전자결재 및 업무 소통용으로 사용됩니다. Datahub에서 작성합니다." />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {APPLICATION_TYPES.map((t) => (
          <ApplicationTypeCard
            key={t.type}
            data={t}
            onSelect={() => {
              // 기존 FormBuilder 경로로 라우팅 — 유형별 신청서 작성.
              console.log("selected type:", t.type);
              router.push(`/governance/forms/${t.type}/new`);
            }}
          />
        ))}
      </div>
    </PhaseLayout>
  );
}
