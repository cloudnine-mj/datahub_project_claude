// 데이터 용역 제작 / 구매 / 구독 — 1. 기획 단계: 어떤 신청서를 작성할지 선택.
//   세 양식은 외부 데이터 도입이라는 공통 목적을 가지며 3단계 프로세스
//   (기획 → 구축 → 적재) 를 공유. 사용자가 자기 상황에 맞는 양식 카드를
//   클릭해 작성으로 진입.
"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileEdit } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FormProcessBar } from "@/components/FormProcessBar";

const CARDS = [
  {
    type: "data_production",
    title: "데이터 용역 제작 신청",
    desc: "외부 업체에 데이터 제작을 의뢰할 때 (작업·납기·검수 기준 정리)",
  },
  {
    type: "data_purchase",
    title: "데이터 구매 신청",
    desc: "외부 데이터셋을 일회성으로 구매할 때 (라이선스·예산 검토 동반)",
  },
  {
    type: "data_subscription",
    title: "데이터 구독 신청",
    desc: "정기적으로 갱신되는 데이터를 월/연 단위 구독할 때",
  },
];

export default function Page() {
  // chevron 의 어떤 단계가 선택됐는지 추적. '신청서 작성'(index 1) 또는 선택 없음
  // (default) 일 때 양식 카드 노출. 다른 단계 선택 시에는 chevron 내부 패널 / 가이드
  // 만 보이도록 카드 숨김.
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const showCards = selectedStep === null || selectedStep === 1;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 용역 제작/구매/구독" },
          { label: "1. 기획" },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">1. 기획</h1>
      <p className="mt-1.5 text-sm text-gray-500">
        도입하려는 데이터 형태에 맞는 신청서를 선택해 작성해 주세요.
        세 양식 모두 같은 3단계 프로세스(기획 → 구축 → 적재) 를 따릅니다.
      </p>

      {/* 데이터 구매 양식 기준의 chevron 진행 바 — 세 양식 모두 동일한 단계 흐름을
          따르므로 통합 진입점에서도 동일한 시각으로 노출.
          '신청서 작성' chevron 클릭 시 #form-content 로 스크롤되도록 카드 컨테이너에
          id 부여. */}
      <FormProcessBar
        formType="data_purchase"
        status="draft"
        onSelectedStepChange={setSelectedStep}
      />

      {showCards && (
        <div id="form-content" className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3 scroll-mt-4">
          {CARDS.map((c) => (
            <Link
              key={c.type}
              href={`/governance/forms/${c.type}/new`}
              className="group rounded-lg border border-gray-200 bg-white p-6 transition hover:border-brand/40 hover:shadow-sm"
            >
              <div className="grid h-10 w-10 place-items-center rounded-md bg-brand/10 text-brand">
                <FileEdit size={20} />
              </div>
              <h3 className="mt-4 text-base font-bold tracking-tight">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{c.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                작성하기 <ArrowRight size={14} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
