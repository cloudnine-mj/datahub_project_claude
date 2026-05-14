// 1. 기획 / substep 3: 전자결재 품의.
//   결재선 / 통보 대상 / g portal 외부 진행 3 블록 구성.
//   결재선·통보 대상은 회사 가이드라인에 명시된 고정 데이터.

"use client";

import { ExternalLink, GitBranch, UsersRound } from "lucide-react";
import { PhaseLayout } from "@/components/PhaseLayout";
import { PhaseBlock } from "@/components/PhaseBlock";
import { HelpBanner } from "@/components/HelpBanner";
import {
  PHASE1_PHASES,
  buildPhase1SubSteps,
  nextPhase1Substep,
  prevPhase1Substep,
} from "@/lib/phase1Substeps";

const NOTIFY_TARGETS = [
  "AI Biz. Development Team장 (박용민)",
  "Data Governance Team장 (김의순)",
  "Data Governance Team 실무자 (김은솔)",
];

export default function Page() {
  const prev = prevPhase1Substep("approval");
  const next = nextPhase1Substep("approval");

  const openGPortal = () => {
    console.log("[stub] g portal 전자결재로 이동");
  };

  return (
    <PhaseLayout
      crumbs={[
        { label: "Governance", href: "/governance/home" },
        { label: "데이터 용역/구매/구독", href: "/governance/forms/planning" },
        { label: "1. 기획 · 전자결재 품의" },
      ]}
      phases={PHASE1_PHASES}
      subSteps={buildPhase1SubSteps("approval")}
      prevPath={prev?.path}
      prevLabel={prev ? `${prev.label} 다시 보기` : undefined}
      nextPath={next.path}
      nextLabel={next.label}
    >
      <HelpBanner message="Datahub에서 작성한 신청서를 기반으로 g portal 전자결재에 품의를 작성하고 승인 요청을 진행합니다." />

      <PhaseBlock icon={GitBranch} title="결재선">
        <InfoRow>신청자의 소속 조직장 전결</InfoRow>
      </PhaseBlock>

      <PhaseBlock icon={UsersRound} title="통보 대상">
        <ul className="space-y-1.5">
          {NOTIFY_TARGETS.map((t) => (
            <li key={t}>
              <InfoRow>{t}</InfoRow>
            </li>
          ))}
        </ul>
      </PhaseBlock>

      <PhaseBlock icon={ExternalLink} title="g portal 전자결재 진행">
        <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
          g portal 전자결재에서 품의를 작성하고 승인 요청해 주세요.
        </p>
        <button
          type="button"
          onClick={openGPortal}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          g portal 전자결재로 이동
          <ExternalLink size={13} aria-hidden="true" />
        </button>
      </PhaseBlock>
    </PhaseLayout>
  );
}

function InfoRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2 text-[13px] text-gray-800 dark:bg-gray-800/40 dark:text-gray-200">
      {children}
    </div>
  );
}
