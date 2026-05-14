// 데이터 도입 신청서 진입 페이지 — 1. 기획 > 신청서 작성 sub-step.
//   3개 유형(용역 제작 / 구매 / 구독) 카드 중 하나를 선택해 작성으로 진입.
// 폰트 weight 는 400/500 만. 600/700 금지.

"use client";

import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProcessStepper } from "@/components/ProcessStepper";
import { StepActions } from "@/components/StepActions";
import { HelpBanner } from "@/components/HelpBanner";
import { ApplicationTypeCard } from "@/components/ApplicationTypeCard";
import { APPLICATION_TYPES } from "@/lib/applicationTypes";

export default function Page() {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance/home" },
          { label: "데이터 용역 제작/구매/구독", href: "/governance/forms/intake" },
          { label: "1. 기획" },
        ]}
      />

      <ProcessStepper
        phases={[
          { id: "plan", label: "1. 기획", status: "current" },
          { id: "build", label: "2. 구축", status: "pending" },
          { id: "deploy", label: "3. 적재", status: "pending" },
        ]}
        subSteps={[
          // 1번 substep 페이지는 아직 미구현 — path 생략 시 클릭 비활성.
          { id: "budget", label: "필요성 정의·예산", status: "done" },
          { id: "form", label: "신청서 작성", status: "current" },
          { id: "discuss", label: "담당자 논의·확정", status: "pending" },
          { id: "approval", label: "전자결재", status: "pending" },
        ]}
      />

      <HelpBanner
        message="도입하려는 데이터 형태에 맞는 신청서를 선택해 작성해 주세요. 어떤 유형인지 모르겠으면"
        ctaLabel="유형 추천 받기"
        onCtaClick={() => {
          // TODO: 추천 모달 또는 별도 페이지 연결. 일단 placeholder.
          console.log("유형 추천 받기 clicked");
        }}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {APPLICATION_TYPES.map((t) => (
          <ApplicationTypeCard
            key={t.type}
            data={t}
            onSelect={() => {
              // 기존 FormBuilder 경로로 라우팅
              console.log("selected type:", t.type);
              router.push(`/governance/forms/${t.type}/new`);
            }}
          />
        ))}
      </div>

      {/* 카드 선택이 곧 다음 단계 진입 — 별도 next 버튼은 비활성 안내용. */}
      <StepActions nextLabel="담당자 논의·확정으로" canProceed={false} />
    </div>
  );
}
