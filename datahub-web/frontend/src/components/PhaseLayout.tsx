// 단계(구축/적재) 페이지 공통 레이아웃 — 브레드크럼 + ProcessStepper + 본문 + 하단 액션.
//   본문은 children 으로 받아 각 페이지가 블록들을 자유롭게 구성.

"use client";

import { Breadcrumb, type Crumb } from "@/components/Breadcrumb";
import { ProcessStepper, type Phase, type SubStep } from "@/components/ProcessStepper";
import { StepActions } from "@/components/StepActions";

interface Props {
  crumbs: Crumb[];
  phases: Phase[];
  subSteps: SubStep[];
  prevPath?: string;
  prevLabel?: string;
  nextPath?: string;
  nextLabel?: string;
  canProceed?: boolean;
  children: React.ReactNode;
}

export function PhaseLayout({
  crumbs,
  phases,
  subSteps,
  prevPath,
  prevLabel,
  nextPath,
  nextLabel,
  canProceed,
  children,
}: Props) {
  return (
    <div className="space-y-3">
      <Breadcrumb items={crumbs} />
      <ProcessStepper phases={phases} subSteps={subSteps} />
      <div className="space-y-3">{children}</div>
      <StepActions
        prevPath={prevPath}
        prevLabel={prevLabel}
        nextPath={nextPath}
        nextLabel={nextLabel}
        canProceed={canProceed}
      />
    </div>
  );
}
