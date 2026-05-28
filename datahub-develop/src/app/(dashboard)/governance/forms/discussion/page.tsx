// 1. 기획 / substep 5: 담당자 논의·확정.
//   신청 유형에 따라 자동 지정된 담당자와 논의 후 요청서 확정.
//   - 담당자와의 논의 카드: 첨부 지원 코멘트 스레드 (담당자 회신 대상 자동).
//   - 확정 게이트: 담당자 코멘트가 최소 1건 이상일 때만 체크박스 활성화,
//     체크해야 '2단계로 진행' 버튼 활성.

"use client";

import { useState } from "react";
import { CheckCircle2, Lock, Check, UserCheck } from "lucide-react";
import { PhaseLayout } from "@/components/governance/PhaseLayout";
import { PhaseBlock } from "@/components/governance/PhaseBlock";
import { PhaseChecklistRow } from "@/components/governance/PhaseChecklistRow";
import { HelpBanner } from "@/components/governance/HelpBanner";
import { DiscussionThread } from "@/components/governance/DiscussionThread";
import {
  buildPhase1SubSteps,
  getPhase1Phases,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/governance/forms/phase1-substeps";
import { useApplicationTypeBreadcrumb } from "@/lib/governance/forms/use-application-type-breadcrumb";
import { usePlanningType } from "@/lib/governance/forms/use-planning-type";

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
  // DiscussionThread 가 통보 — 담당자(assignee) 코멘트가 1건 이상이면 true.
  const [hasAssigneeReply, setHasAssigneeReply] = useState(false);
  const type = usePlanningType();
  const prev = prevPhase1Substep("discussion", type);
  const next = nextPhase1Substep("discussion", type);
  const typeCrumb = useApplicationTypeBreadcrumb();

  // 확정 게이트: 담당자 회신이 있어야 체크박스 활성.
  const canCheckConfirm = hasAssigneeReply;
  // 다음 단계: 체크박스가 체크된 후에만 활성.
  const canProceed = canCheckConfirm && confirmed;

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        typeCrumb,
        { label: "담당자 논의·확정" },
      ]}
      phases={getPhase1Phases(type)}
      subSteps={buildPhase1SubSteps("discussion", type)}
      prevPath={prev?.path}
      prevLabel={prev ? `${prev.label} 다시 보기` : undefined}
      nextPath={next.path}
      nextLabel={next.label}
      canProceed={canProceed}
    >
      <HelpBanner message="지정된 담당자와 데이터 구축/구매/구독을 논의한 후 요청서를 확정합니다." />

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

      <DiscussionThread
        planningType={type}
        onAssigneeReplyChange={setHasAssigneeReply}
      />

      <PhaseBlock icon={CheckCircle2} title="요청서 확정">
        <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          담당자와 논의를 마친 후 요청서를 최종 확정합니다.
        </p>
        <div className={canCheckConfirm ? "" : "pointer-events-none opacity-45"}>
          <PhaseChecklistRow
            id="discussion-confirmed"
            label="담당자 논의 및 요청서 확정"
            checked={confirmed}
            onToggle={() => setConfirmed((v) => !v)}
          />
        </div>
        <p className="mt-2 inline-flex items-center gap-1 text-[11px]">
          {canCheckConfirm ? (
            <>
              <Check size={11} className="text-emerald-600" aria-hidden="true" />
              <span className="text-emerald-700">
                담당자 논의가 완료되었습니다. 확정할 수 있습니다.
              </span>
            </>
          ) : (
            <>
              <Lock size={11} className="text-gray-400" aria-hidden="true" />
              <span className="text-gray-500">
                담당자와 논의를 먼저 진행해주세요.
              </span>
            </>
          )}
        </p>
      </PhaseBlock>
    </PhaseLayout>
  );
}
