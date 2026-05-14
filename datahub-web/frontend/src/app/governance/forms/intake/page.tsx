// 1. 기획 / substep 2: 신청서 작성.
//   계획 수립 단계에서 선택한 신청 유형(?type=) + 상태(?status=) 를 query 로 받아
//   유형별 양식 + 상태 분기 렌더 (작성/제출/검토/승인).
//   상위 PhaseLayout 의 StepActions 는 사용하지 않음 — 컨테이너가 자체 액션 영역을 가짐.

import { PhaseLayout } from "@/components/PhaseLayout";
import { PhaseBlock } from "@/components/PhaseBlock";
import { FileText } from "lucide-react";
import { ApplicationFormContainer } from "@/components/ApplicationForm/ApplicationFormContainer";
import {
  PHASE1_PHASES,
  buildPhase1SubSteps,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/phase1Substeps";
import type {
  ApplicationStatus,
  ApplicationType,
} from "@/lib/applicationFormConfig";

interface PageProps {
  searchParams?: { type?: string; status?: string };
}

function parseType(raw: string | undefined): ApplicationType | null {
  if (raw === "service" || raw === "purchase" || raw === "subscribe") return raw;
  return null;
}

function parseStatus(raw: string | undefined): ApplicationStatus {
  if (
    raw === "draft" ||
    raw === "submitted" ||
    raw === "reviewing" ||
    raw === "approved"
  )
    return raw;
  return "draft";
}

export default function Page({ searchParams }: PageProps) {
  const prev = prevPhase1Substep("form");
  const next = nextPhase1Substep("form");
  const type = parseType(searchParams?.type);
  const status = parseStatus(searchParams?.status);

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
        { label: "1. 기획 · 신청서 작성" },
      ]}
      phases={PHASE1_PHASES}
      subSteps={buildPhase1SubSteps("form")}
    >
      {type ? (
        <ApplicationFormContainer
          type={type}
          initialStatus={status}
          prevPath={prev?.path}
          nextPath={next.path}
        />
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
