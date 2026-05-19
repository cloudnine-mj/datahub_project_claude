// 1. 기획 / substep 5: 담당자 논의·확정.
//   신청 유형에 따라 자동 지정된 담당자와 논의 후 신청서 확정.
//   가이드라인 명세대로 협의 항목·메시지 입력 등은 추가하지 않음.

"use client";

import { useState } from "react";
import { CheckCircle2, UserCheck } from "lucide-react";
import { PhaseLayout } from "@/components/PhaseLayout";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseChecklistRow } from "@/components/PhaseChecklistRow";
import { HelpBanner } from "@/components/HelpBanner";
import {
  PHASE1_PHASES,
  buildPhase1SubSteps,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/phase1Substeps";
import { useApplicationTypeBreadcrumb } from "@/lib/useApplicationTypeBreadcrumb";

const ASSIGNEES: { typeLabel: string; description: string }[] = [
  {
    typeLabel: "구매/구독",
    description: "AI Biz. Development Team (박용민) 담당자 지정 후 논의",
  },
  {
    typeLabel: "용역",
    description: "Data Governance Team (김은솔) 논의",
  },
];

export default function Page() {
  const [confirmed, setConfirmed] = useState(false);
  const prev = prevPhase1Substep("discussion");
  const next = nextPhase1Substep("discussion");
  const typeCrumb = useApplicationTypeBreadcrumb();

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        typeCrumb,
        { label: "1. 기획 · 담당자 논의·확정" },
      ]}
      phases={PHASE1_PHASES}
      subSteps={buildPhase1SubSteps("discussion")}
      prevPath={prev?.path}
      prevLabel={prev ? `${prev.label} 다시 보기` : undefined}
      nextPath={next.path}
      nextLabel={next.label}
    >
      <HelpBanner message="지정된 담당자와 데이터 구축/구매/구독을 논의한 후 신청서를 확정합니다." />

      <PhaseBlock icon={UserCheck} title="지정된 담당자">
        <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          신청 유형에 따라 담당자가 지정됩니다.
        </p>
        <ul className="space-y-1.5">
          {ASSIGNEES.map((a) => (
            <li
              key={a.typeLabel}
              className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/40"
            >
              <span className="inline-flex shrink-0 items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                {a.typeLabel}
              </span>
              <span className="text-[13px] text-gray-800 dark:text-gray-200">
                {a.description}
              </span>
            </li>
          ))}
        </ul>
      </PhaseBlock>

      <PhaseBlock icon={CheckCircle2} title="신청서 확정">
        <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          담당자와 논의를 마친 후 신청서를 최종 확정합니다.
        </p>
        <PhaseChecklistRow
          id="discussion-confirmed"
          label="담당자 논의 및 신청서 확정"
          checked={confirmed}
          onToggle={() => setConfirmed((v) => !v)}
        />
      </PhaseBlock>
    </PhaseLayout>
  );
}
