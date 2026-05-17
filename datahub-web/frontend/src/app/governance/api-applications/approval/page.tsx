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
          { label: "1. 기획 · 전자결재 품의" },
        ]}
      />
      <ApiProcessStepper currentSubstep="approval" />
      <ApiProcessSummary currentSubstep="approval" />
    </div>
  );
}
