// 1. 기획 / 계획 수립 substep 페이지 컨테이너 — 1단계 첫 화면.
//   유형 선택 → 유형별 체크리스트 동적 렌더 → '신청서 작성으로' 진입.
//   유형 전환 시 체크 상태 초기화 (체크리스트는 유형별로 다름).

"use client";

import { useState } from "react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProcessStepper } from "@/components/ProcessStepper";
import { HelpBanner } from "@/components/HelpBanner";
import { TypeSelector } from "@/components/Planning/TypeSelector";
import { ChecklistBlock } from "@/components/Planning/ChecklistBlock";
import { PlanningFooter } from "@/components/Planning/PlanningFooter";
import { PLANNING_CONFIG, type PlanningType } from "@/lib/planningConfig";

export function PlanningSubstep() {
  const [type, setType] = useState<PlanningType>("service");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const blocks = PLANNING_CONFIG[type];

  const onTypeChange = (next: PlanningType) => {
    setType(next);
    // 유형별 체크리스트가 달라 ID 충돌·잔존 가능 → 전환 시 초기화.
    setChecks({});
  };

  const onToggle = (itemId: string) => {
    setChecks((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
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
        phases={[
          { id: "plan", label: "1. 기획", status: "current" },
          { id: "build", label: "2. 구축", status: "pending" },
          { id: "load", label: "3. 적재", status: "pending" },
        ]}
        subSteps={[
          { id: "planning", label: "계획 수립", status: "current" },
          { id: "form", label: "신청서 작성", status: "pending" },
          { id: "approval", label: "전자결재·승인", status: "pending" },
          { id: "discuss", label: "담당자 논의·확정", status: "pending" },
        ]}
      />

      <HelpBanner
        message='신청서를 작성하기 전에 아래 사항을 미리 정리·확인해 주세요. 다음 단계인 "신청서 작성"에서 이 내용을 양식에 입력하게 됩니다.'
      />

      <TypeSelector value={type} onChange={onTypeChange} />

      {blocks.map((block) => (
        <ChecklistBlock
          key={block.id}
          block={block}
          checks={checks}
          onToggle={onToggle}
        />
      ))}

      <PlanningFooter nextPath="/governance/forms/intake" />
    </div>
  );
}
