// 1. 기획 / 계획 수립 substep — 좌측 검토 질문 + 우측 작성 예시 분할.
//   체크박스 없는 자기 점검 — 진행 차단 조건 없음.
//   유형 전환 시 좌우 양쪽 컨텐츠가 동시에 교체.
//   용역 유형만 하단에 '용역 제작 요건 확인' 카드 추가.

"use client";

import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProcessStepper } from "@/components/ProcessStepper";
import { HelpBanner } from "@/components/HelpBanner";
import { TypeSelector } from "@/components/Planning/TypeSelector";
import { ReviewQuestionsCard } from "@/components/Planning/ReviewQuestionsCard";
import { ReviewExampleCard } from "@/components/Planning/ReviewExampleCard";
import { RequirementsCard } from "@/components/Planning/RequirementsCard";
import { PlanningFooter } from "@/components/Planning/PlanningFooter";
import {
  PLANNING_REVIEW_CONFIG,
  type PlanningType,
} from "@/lib/planningConfig";
import { PHASE1_PHASES, buildPhase1SubSteps } from "@/lib/phase1Substeps";

export function PlanningSubstep() {
  const [type, setType] = useState<PlanningType>("service");

  const review = PLANNING_REVIEW_CONFIG[type];

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
          { label: "1. 기획 · 계획 수립" },
        ]}
      />

      <ProcessStepper
        phases={PHASE1_PHASES}
        subSteps={buildPhase1SubSteps("planning")}
      />

      <HelpBanner message="신청서를 작성하기 전에 아래 사항을 미리 정리·확인해 주세요." />

      <TypeSelector value={type} onChange={setType} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReviewQuestionsCard questions={review.questions} />
        <ReviewExampleCard
          title={review.exampleTitle}
          subtitle={review.exampleSubtitle}
          items={review.exampleItems}
        />
      </div>

      {review.requirements && review.requirements.length > 0 && (
        <RequirementsCard requirements={review.requirements} />
      )}

      <PlanningFooter nextPath="/governance/forms/intake" type={type} />
    </div>
  );
}
