// 용역(service): 2. 구축 단계 — 3 카드(계약/중간 수령/최종 수령) 한 페이지 노출.
// 구매·구독(purchase/subscribe): 1. 기획 마지막 substep '계약 체결' — 계약 카드만 노출,
//   상단 stepper 도 2-phase ProcessStepper 로 교체. 완료 시 곧장 2단계 적재(load) 로 진행.

"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileBadge,
  Package,
} from "lucide-react";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { ProcessStepper } from "@/components/governance/ProcessStepper";
import { BuildStepper } from "@/components/governance/phase-build/BuildStepper";
import { BuildStepCard } from "@/components/governance/phase-build/BuildStepCard";
import { ContractStepBody } from "@/components/governance/phase-build/ContractStepBody";
import { DeliveryStepBody } from "@/components/governance/phase-build/DeliveryStepBody";
import { FinalStepBody } from "@/components/governance/phase-build/FinalStepBody";
import { useBuildPhase } from "@/components/governance/phase-build/useBuildPhase";
import { useApplicationTypeBreadcrumb } from "@/lib/governance/forms/use-application-type-breadcrumb";
import { usePlanningType } from "@/lib/governance/forms/use-planning-type";
import {
  buildPhase1SubSteps,
  getPhase1Phases,
} from "@/lib/governance/forms/phase1-substeps";

export default function Page() {
  const router = useRouter();
  const phase = useBuildPhase();
  const typeCrumb = useApplicationTypeBreadcrumb();
  const planningType = usePlanningType();
  const isTwoPhase = planningType === "purchase" || planningType === "subscribe";

  const contractRef = useRef<HTMLElement>(null);
  const deliveryRef = useRef<HTMLElement>(null);
  const finalRef = useRef<HTMLElement>(null);

  const scrollTo = (id: string) => {
    const ref =
      id === "contract" ? contractRef : id === "delivery" ? deliveryRef : finalRef;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onProceedToLoad = () => router.push("/governance/forms/intake/load");

  const contractCanComplete =
    !!phase.contract.approvalNumber.trim() && phase.contract.agreementConfirmed;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          typeCrumb,
          { label: isTwoPhase ? "1. 기획 · 계약 체결" : "2. 구축" },
        ]}
      />

      {isTwoPhase ? (
        <ProcessStepper
          phases={getPhase1Phases(planningType)}
          subSteps={buildPhase1SubSteps("contract", planningType)}
        />
      ) : (
        <BuildStepper
          onScrollTo={scrollTo}
          substeps={[
            { id: "contract", label: "계약 체결", status: phase.contract.status },
            {
              id: "delivery",
              label: "중간 수령·검수·피드백",
              status: phase.delivery.status,
            },
            { id: "final", label: "최종 수령", status: phase.final.status },
          ]}
        />
      )}

      <BuildStepCard
        cardRef={contractRef}
        id="contract"
        title="계약 체결 확인"
        status={phase.contract.status}
        current={{
          icon: FileBadge,
          description:
            "계약품의 품의번호를 입력하면 계약 체결 여부가 확인됩니다. 데이터 활용 협약은 별도 협약 또는 계약서에 포함되어야 합니다.",
          children: (
            <ContractStepBody
              contract={phase.contract}
              onChangeApprovalNumber={phase.onChangeApprovalNumber}
              onToggleAgreement={phase.onToggleAgreement}
              onConfirm={() => {
                /* 데모 — 별도 확인 처리 없이 입력 상태만 유지. 완료 트리거는 아래 버튼. */
              }}
            />
          ),
          completeLabel: isTwoPhase
            ? "계약 확인 완료 · 2단계 적재로"
            : "계약 확인 완료 · 중간 수령으로",
          onComplete: () => {
            phase.completeContract();
            if (isTwoPhase) onProceedToLoad();
          },
          canComplete: contractCanComplete,
        }}
        done={{
          completedAt: phase.contract.completedAt ?? "",
          summary: (
            <dl
              className="grid gap-x-3.5 gap-y-1.5 text-xs"
              style={{ gridTemplateColumns: "auto 1fr" }}
            >
              <dt className="text-gray-500 dark:text-gray-400">계약품의 품의번호</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-100">
                {phase.contract.approvalNumber}
              </dd>
              <dt className="text-gray-500 dark:text-gray-400">데이터 활용 협약</dt>
              <dd className="text-green-700 dark:text-green-300">
                ✓ 체결됨 (계약서 조항 포함)
              </dd>
            </dl>
          ),
          onShowDetail: () => console.log("[stub] 계약 상세"),
        }}
      />

      {!isTwoPhase && (
      <>
      <BuildStepCard
        cardRef={deliveryRef}
        id="delivery"
        title="중간 수령 · 검수 · 피드백"
        status={phase.delivery.status}
        current={{
          icon: Package,
          description:
            "중간 납품받은 데이터를 Datahub에 적재해 관리하고, 검수 결과와 피드백을 기록하세요.",
          children: (
            <DeliveryStepBody
              delivery={phase.delivery}
              onAddUpload={phase.addIntermediateUpload}
              onAddFeedback={phase.addFeedback}
            />
          ),
          completeLabel: "검수 완료 · 최종 수령으로",
          onComplete: phase.completeDelivery,
          canComplete: true,
        }}
        done={{
          completedAt: phase.delivery.completedAt ?? "",
          summary: (
            <dl
              className="grid gap-x-3.5 gap-y-1.5 text-xs"
              style={{ gridTemplateColumns: "auto 1fr" }}
            >
              <dt className="text-gray-500 dark:text-gray-400">적재 건수</dt>
              <dd className="text-gray-900 dark:text-gray-100">
                {phase.delivery.intermediateUploads.length}건
              </dd>
              <dt className="text-gray-500 dark:text-gray-400">피드백 기록</dt>
              <dd className="text-gray-900 dark:text-gray-100">
                {phase.delivery.feedbacks.length}건
              </dd>
            </dl>
          ),
          onShowDetail: () => console.log("[stub] 중간 수령 상세"),
        }}
        locked={{ activationHint: "계약 체결이 완료되면 활성화됩니다" }}
      />

      <BuildStepCard
        cardRef={finalRef}
        id="final"
        title="최종 데이터 수령"
        status={phase.final.status}
        current={{
          icon: CheckCircle2,
          description: "최종 데이터 수령을 확인하면 3단계 적재로 진행할 수 있습니다.",
          children: (
            <FinalStepBody final={phase.final} onToggle={phase.onToggleFinalReceived} />
          ),
          completeLabel: "최종 수령 확인",
          onComplete: phase.completeFinal,
          canComplete: phase.final.received,
        }}
        done={{
          completedAt: phase.final.completedAt ?? "",
          summary: (
            <p className="text-xs text-gray-700 dark:text-gray-300">
              ✓ 최종 데이터를 수령했습니다.
            </p>
          ),
          onShowDetail: () => console.log("[stub] 최종 수령 상세"),
        }}
        locked={{ activationHint: "중간 수령·검수가 완료되면 활성화됩니다" }}
      />
      </>
      )}

      <div className="flex items-center justify-between gap-2">
        <Link
          href={isTwoPhase ? "/governance/forms/approval" : "/governance/forms/planning"}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {isTwoPhase ? "전자결재 품의 다시 보기" : "1단계 다시 보기"}
        </Link>
        {!isTwoPhase && (
          <button
            type="button"
            aria-label="페이지 아래로 스크롤"
            onClick={() => scrollTo("final")}
            className="rounded-full p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={onProceedToLoad}
          disabled={!isTwoPhase && !phase.allDone}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500"
        >
          {isTwoPhase
            ? "2단계 적재로 진행"
            : phase.allDone
            ? "3단계로 진행"
            : "3단계로 진행 · 모든 단계 완료 후"}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
