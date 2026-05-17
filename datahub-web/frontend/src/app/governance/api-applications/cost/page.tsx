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
          { label: "2. 운영 · 비용 처리" },
        ]}
      />
      <ApiProcessStepper currentSubstep="cost" />
      <ApiProcessSummary currentSubstep="cost" />
    </div>
  );
}
