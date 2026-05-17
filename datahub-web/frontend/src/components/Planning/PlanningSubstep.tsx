// 1. 기획 / 계획 수립 substep — 좌측 검토 질문 + 우측 작성 예시 분할.
//   체크박스 자기 점검 — 진행 차단 조건 없음.
//   유형 전환 시 좌우 양쪽 컨텐츠가 동시에 교체.
//   용역 유형만 하단에 '용역 제작 요건 확인' 카드 추가.
//   유형 선택 + 체크 상태는 sessionStorage 에 저장 — 다른 단계 다녀와도 복원.

"use client";

import { useEffect, useState } from "react";
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

const TYPE_KEY = "datahub:planningType";
const CHECKS_KEY = (t: PlanningType) => `datahub:planningChecks:${t}`;

function isPlanningType(v: string): v is PlanningType {
  return v === "purchase" || v === "subscribe" || v === "service";
}

export function PlanningSubstep() {
  const [type, setType] = useState<PlanningType>("service");
  // 검토 항목 + 용역 요건 체크 — 유형별 라벨이 다를 수 있어 raw label key 기반.
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  // 마운트 시 sessionStorage 에서 직전 선택 유형 + 체크 상태 복원.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedType = sessionStorage.getItem(TYPE_KEY);
    const resolvedType: PlanningType =
      savedType && isPlanningType(savedType) ? savedType : "service";
    setType(resolvedType);
    try {
      const savedChecks = sessionStorage.getItem(CHECKS_KEY(resolvedType));
      if (savedChecks) setChecks(JSON.parse(savedChecks));
    } catch {
      /* 깨진 JSON — 무시 */
    }
  }, []);

  const review = PLANNING_REVIEW_CONFIG[type];

  const onTypeChange = (next: PlanningType) => {
    setType(next);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(TYPE_KEY, next);
    }
    // 유형 전환 시 체크 — 해당 유형으로 저장된 값이 있으면 복원, 없으면 빈 객체.
    let restored: Record<string, boolean> = {};
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(CHECKS_KEY(next));
        if (raw) restored = JSON.parse(raw);
      } catch {
        /* 깨진 JSON — 무시 */
      }
    }
    setChecks(restored);
  };

  const onToggle = (key: string) => {
    setChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        sessionStorage.setItem(CHECKS_KEY(type), JSON.stringify(next));
      }
      return next;
    });
  };

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

      <TypeSelector value={type} onChange={onTypeChange} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ReviewQuestionsCard
          questions={review.questions}
          checks={checks}
          onToggle={onToggle}
        />
        <ReviewExampleCard
          title={review.exampleTitle}
          subtitle={review.exampleSubtitle}
          items={review.exampleItems}
        />
      </div>

      {review.requirements && review.requirements.length > 0 && (
        <RequirementsCard
          requirements={review.requirements}
          checks={checks}
          onToggle={onToggle}
        />
      )}

      <PlanningFooter nextPath="/governance/forms/intake" type={type} />
    </div>
  );
}
