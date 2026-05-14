// 데이터 도입 신청서 진입 페이지 — 1. 기획 > 신청서 작성 sub-step.
//   3개 유형(용역 제작 / 구매 / 구독) 카드 중 하나를 선택해 작성으로 진입.
// 폰트 weight 는 400/500 만. 600/700 금지.

"use client";

import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProcessStepper } from "@/components/ProcessStepper";
import { HelpBanner } from "@/components/HelpBanner";
import { ApplicationTypeCard } from "@/components/ApplicationTypeCard";
import { APPLICATION_TYPES } from "@/lib/applicationTypes";

export default function Page() {
  const router = useRouter();

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 용역 제작/구매/구독" },
          { label: "1. 기획" },
        ]}
      />

      <ProcessStepper currentPhase={1} currentSubStep={2} />

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
    </div>
  );
}
