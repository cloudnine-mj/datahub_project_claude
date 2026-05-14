// 1. 기획 / substep 2: 신청서 작성.
//   계획 수립 단계에서 선택한 신청 유형(?type=purchase|subscribe|service) 에 따라
//   해당 유형의 FormBuilder 를 inline 으로 렌더. type 미지정 시 안내 placeholder.

import { FileText } from "lucide-react";
import { PhaseLayout } from "@/components/PhaseLayout";
import { PhaseBlock } from "@/components/PhaseBlock";
import { HelpBanner } from "@/components/HelpBanner";
import { FormBuilder } from "@/components/FormBuilder";
import {
  PHASE1_PHASES,
  buildPhase1SubSteps,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/phase1Substeps";
import {
  PLANNING_TO_FORM_TYPE,
  type PlanningType,
} from "@/lib/planningConfig";
import type { FormType } from "@/lib/api";

interface PageProps {
  searchParams?: { type?: string };
}

function resolveFormType(raw: string | undefined): FormType | null {
  if (!raw) return null;
  if (raw === "purchase" || raw === "subscribe" || raw === "service") {
    return PLANNING_TO_FORM_TYPE[raw as PlanningType] as FormType;
  }
  return null;
}

export default function Page({ searchParams }: PageProps) {
  const prev = prevPhase1Substep("form");
  const next = nextPhase1Substep("form");
  const formType = resolveFormType(searchParams?.type);

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

      {formType ? (
        <FormBuilder formType={formType} embedded />
      ) : (
        <PhaseBlock icon={FileText} title="신청서 작성">
          <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
            계획 수립 단계에서 신청 유형을 선택한 뒤 다시 진입해 주세요.
          </p>
          <div className="rounded-lg bg-gray-50 px-4 py-10 text-center dark:bg-gray-800/40">
            <p className="text-sm text-gray-500 dark:text-gray-400">신청 유형별 양식 영역</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              (구매/구독/용역 각각의 양식이 표시되는 자리)
            </p>
          </div>
        </PhaseBlock>
      )}
    </PhaseLayout>
  );
}
