// API 활용 계획서 · 2단계 운영.
//   3 substep(API 활용 / 비용 처리 / 결과물 적재) 카드를 한 페이지에 모두 노출.
//   각 카드는 useOperatePhase 의 상태(locked/current/done) 에 따라 디자인 분기.
//   상단 ApiProcessStepper 는 onlyCurrentPhase 로 2단계 substep 만 노출.

"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, Folder, Zap } from "lucide-react";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { ApiProcessStepper } from "@/components/governance/ApiProcess/ApiProcessStepper";
import { OperateStepCard } from "@/components/governance/api-operate/OperateStepCard";
import { ApiUsageStepBody } from "@/components/governance/api-operate/ApiUsageStepBody";
import { CostProcessStepBody } from "@/components/governance/api-operate/CostProcessStepBody";
import { FinalStoreStepBody } from "@/components/governance/api-operate/FinalStoreStepBody";
import { useOperatePhase } from "@/components/governance/api-operate/useOperatePhase";
import type { StepStatus as ApiStepStatus } from "@/lib/governance/forms/api-process-config";
import type { StepStatus as OperateStatus } from "@/components/governance/api-operate/useOperatePhase";

function toApiStepStatus(s: OperateStatus): ApiStepStatus {
  if (s === "done") return "completed";
  if (s === "current") return "current";
  return "pending";
}

export default function Page() {
  const phase = useOperatePhase();
  const apiUsageRef = useRef<HTMLElement>(null);
  const costRef = useRef<HTMLElement>(null);
  const storeRef = useRef<HTMLElement>(null);

  // 상단 stepper 에 운영 substep 상태 반영.
  // 여러 substep 이 동시에 'current' 일 수 있는 데모 모드에서, 시각적으로는 첫 current 만 강조.
  const rawStatuses: Array<["api-operate" | "cost" | "store", ApiStepStatus]> = [
    ["api-operate", toApiStepStatus(phase.apiUsage.status)],
    ["cost", toApiStepStatus(phase.costProcess.status)],
    ["store", toApiStepStatus(phase.finalStore.status)],
  ];
  let currentSeen = false;
  const substepStatusMap = Object.fromEntries(
    rawStatuses.map(([id, status]) => {
      if (status === "current") {
        if (currentSeen) return [id, "pending" as ApiStepStatus];
        currentSeen = true;
      }
      return [id, status];
    }),
  ) as Record<"api-operate" | "cost" | "store", ApiStepStatus>;

  const finalCanComplete =
    phase.finalStore.storageUploaded &&
    phase.finalStore.metadataCompleted &&
    phase.finalStore.dataCardCompleted;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "API 활용 계획서", href: "/governance/api-applications/planning" },
          { label: "2. 운영" },
        ]}
      />

      <ApiProcessStepper
        currentSubstep="api-operate"
        substepStatusMap={substepStatusMap}
        onlyCurrentPhase
      />

      {/* 카드 1: API 활용 */}
      <OperateStepCard
        cardRef={apiUsageRef}
        id="api-usage"
        title="API 활용 확인"
        status={phase.apiUsage.status}
        current={{
          icon: Zap,
          description:
            "API 사용을 시작했는지 확인하세요. 사용 시작일과 결제 수단을 기록합니다.",
          children: (
            <ApiUsageStepBody
              apiUsage={phase.apiUsage}
              onChangeStartDate={phase.onChangeStartDate}
              onChangePaymentMethod={phase.onChangePaymentMethod}
            />
          ),
          completeLabel: "API 활용 확인 · 비용 처리로",
          onComplete: phase.completeApiUsage,
          canComplete:
            phase.apiUsage.startDate.trim().length > 0 &&
            phase.apiUsage.paymentMethod.trim().length > 0,
        }}
        done={{
          completedAt: phase.apiUsage.completedAt ?? "",
          summary: (
            <dl
              className="grid gap-x-3.5 gap-y-1.5 text-xs"
              style={{ gridTemplateColumns: "auto 1fr" }}
            >
              <dt className="text-gray-500 dark:text-gray-400">사용 시작</dt>
              <dd className="text-gray-900 dark:text-gray-100">{phase.apiUsage.startDate}</dd>
              <dt className="text-gray-500 dark:text-gray-400">결제 수단</dt>
              <dd className="text-gray-900 dark:text-gray-100">{phase.apiUsage.paymentMethod}</dd>
            </dl>
          ),
          onShowDetail: () => console.log("[stub] API 활용 상세"),
        }}
      />

      {/* 카드 2: 비용 처리 */}
      <OperateStepCard
        cardRef={costRef}
        id="cost-process"
        title="비용 처리"
        status={phase.costProcess.status}
        current={{
          icon: CreditCard,
          description:
            "기획 단계에서 작성한 품의서로 비용 처리합니다. 매월 사용 비용을 기록하세요.",
          children: (
            <CostProcessStepBody
              costProcess={phase.costProcess}
              onAddRecord={phase.addCostRecord}
            />
          ),
          completeLabel: "비용 처리 완료 · 결과물 적재로",
          onComplete: phase.completeCostProcess,
          canComplete: phase.costProcess.costRecords.length > 0,
        }}
        done={{
          completedAt: phase.costProcess.completedAt ?? "",
          summary: (
            <dl
              className="grid gap-x-3.5 gap-y-1.5 text-xs"
              style={{ gridTemplateColumns: "auto 1fr" }}
            >
              <dt className="text-gray-500 dark:text-gray-400">품의번호</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-100">
                {phase.costProcess.approvalNumber}
              </dd>
              <dt className="text-gray-500 dark:text-gray-400">기록 건수</dt>
              <dd className="text-gray-900 dark:text-gray-100">
                {phase.costProcess.costRecords.length}건
              </dd>
            </dl>
          ),
          onShowDetail: () => console.log("[stub] 비용 처리 상세"),
        }}
        locked={{ activationHint: "API 활용 확인이 완료되면 활성화됩니다" }}
      />

      {/* 카드 3: 결과물 적재 */}
      <OperateStepCard
        cardRef={storeRef}
        id="final-store"
        title="결과물 적재"
        status={phase.finalStore.status}
        current={{
          icon: Folder,
          description: "최종 결과물을 적재하고 메타데이터·데이터카드를 작성하세요.",
          children: (
            <FinalStoreStepBody
              finalStore={phase.finalStore}
              onToggleStorage={phase.toggleStorageUploaded}
              onToggleMetadata={phase.toggleMetadata}
              onToggleDataCard={phase.toggleDataCard}
            />
          ),
          completeLabel: "결과물 적재 확인",
          onComplete: phase.completeFinalStore,
          canComplete: finalCanComplete,
        }}
        done={{
          completedAt: phase.finalStore.completedAt ?? "",
          summary: (
            <p className="text-xs text-gray-700 dark:text-gray-300">
              ✓ 중앙 저장소 적재 + 메타데이터·데이터카드 작성 완료
            </p>
          ),
          onShowDetail: () => console.log("[stub] 결과물 적재 상세"),
        }}
        locked={{ activationHint: "비용 처리가 완료되면 활성화됩니다" }}
      />

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Link
          href="/governance/api-applications/approval"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          1단계 다시 보기
        </Link>
        <button
          type="button"
          disabled={!phase.allDone}
          onClick={() => console.log("[stub] API 활용 신청 완료 처리")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={14} aria-hidden="true" />
          신청 완료 처리
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
