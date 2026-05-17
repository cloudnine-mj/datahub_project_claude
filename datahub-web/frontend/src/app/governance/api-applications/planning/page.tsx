// API 활용 계획서 · 1단계 기획 · 계획 수립.
//   2-phase ProcessStepper + 전체 흐름 요약 패널을 노출하는 데모 페이지.

import { Breadcrumb } from "@/components/Breadcrumb";
import { ApiProcessStepper } from "@/components/ApiProcess/ApiProcessStepper";
import { ApiProcessSummary } from "@/components/ApiProcess/ApiProcessSummary";

export default function Page() {
  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "API 활용 계획서", href: "/governance/api-applications/planning" },
          { label: "1. 기획 · 계획 수립" },
        ]}
      />

      <ApiProcessStepper currentSubstep="planning" />
      <ApiProcessSummary currentSubstep="planning" />
    </div>
  );
}
