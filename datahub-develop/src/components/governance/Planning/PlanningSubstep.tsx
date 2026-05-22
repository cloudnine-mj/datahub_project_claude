// 1. 기획 / 계획 수립 substep — 좌측 검토 질문 + 우측 작성 예시 분할.
//   유형(service/purchase/subscribe) 은 URL ?type= 으로 명시. 사이드바에서 3개 메뉴로
//   분리되었으므로 페이지 내 유형 선택 토글은 노출하지 않음.
//   체크 상태는 sessionStorage 에 유형별로 저장 — 다른 단계 다녀와도 복원.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { ProcessStepper } from "@/components/governance/ProcessStepper";
import { HelpBanner } from "@/components/governance/HelpBanner";
import { ReviewQuestionsCard } from "@/components/governance/Planning/ReviewQuestionsCard";
import { ReviewExampleCard } from "@/components/governance/Planning/ReviewExampleCard";
import { RequirementsCard } from "@/components/governance/Planning/RequirementsCard";
import { PlanningFooter } from "@/components/governance/Planning/PlanningFooter";
import {
  PLANNING_REVIEW_CONFIG,
  type PlanningType,
} from "@/lib/governance/forms/planning-config";
import {
  APPLICATION_TYPE_META,
  isPlanningType,
} from "@/lib/governance/forms/application-type-meta";
import { buildPhase1SubSteps, getPhase1Phases } from "@/lib/governance/forms/phase1-substeps";

const TYPE_KEY = "datahub:planningType";
const CHECKS_KEY = (t: PlanningType) => `datahub:planningChecks:${t}`;

export function PlanningSubstep() {
  const search = useSearchParams();
  const urlType = search.get("type");
  const [type, setType] = useState<PlanningType>(() =>
    isPlanningType(urlType) ? urlType : "service",
  );
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  // URL ?type= 우선 → sessionStorage → 기본값(service). 결정된 type 은
  // sessionStorage 에도 저장해 다른 substep 이 그대로 이어받게 함.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let resolved: PlanningType = "service";
    if (isPlanningType(urlType)) {
      resolved = urlType;
    } else {
      const saved = sessionStorage.getItem(TYPE_KEY);
      if (isPlanningType(saved)) resolved = saved;
    }
    setType(resolved);
    sessionStorage.setItem(TYPE_KEY, resolved);
    try {
      const savedChecks = sessionStorage.getItem(CHECKS_KEY(resolved));
      setChecks(savedChecks ? JSON.parse(savedChecks) : {});
    } catch {
      setChecks({});
    }
  }, [urlType]);

  const review = PLANNING_REVIEW_CONFIG[type];
  const meta = APPLICATION_TYPE_META[type];
  const Icon = meta.icon;

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
          { label: meta.label, href: `/governance/forms/planning?type=${type}` },
          { label: "계획 수립" },
        ]}
      />

      {/* 유형별 페이지 헤더 */}
      <header className="mb-1">
        <div className="mb-1 flex items-center gap-2">
          <Icon size={18} aria-hidden="true" className="text-brand" />
          <h1 className="text-[20px] font-medium text-gray-900 dark:text-gray-100">
            {meta.label}
          </h1>
        </div>
        <p className="text-[12px] text-gray-500 dark:text-gray-400">{meta.description}</p>
      </header>

      <ProcessStepper
        phases={getPhase1Phases(type)}
        subSteps={buildPhase1SubSteps("planning", type)}
      />

      <HelpBanner message="신청서를 작성하기 전에 아래 사항을 미리 정리·확인해 주세요." />

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
