// API 활용 계획서 · 1단계 기획 · 계획 수립.
//   페이지 헤더 + ProcessStepper + 안내 배너 + 사전 품의서 라디오 + 좌우 분할
//   (검토 사항 / 작성 예시) + 예산 체크박스 + 하단 [신청서 작성으로] 액션.

import { Breadcrumb } from "@/components/Breadcrumb";
import { ApiPlanningSubstep } from "@/components/api-planning/ApiPlanningSubstep";

export default function Page() {
  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "API 활용 계획서", href: "/governance/api-applications/planning" },
          { label: "1. 기획 · 계획 수립" },
        ]}
      />

      <ApiPlanningSubstep />
    </div>
  );
}
