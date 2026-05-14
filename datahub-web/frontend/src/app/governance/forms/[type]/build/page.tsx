// 신청서 작성 후 '구축' 단계 — 외주 업체 선정 / 계약 / 검수.
// 현재 별도 시스템 연동이 없어 '준비 중' 안내 페이지만 노출.
"use client";

import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FORM_TYPE_LABELS } from "@/lib/utils";
import type { FormType } from "@/lib/api";

export default function Page({ params }: { params: { type: string } }) {
  const formLabel = FORM_TYPE_LABELS[params.type as FormType] ?? params.type;
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 거버넌스 문서 서식 모음", href: "/governance/forms" },
          { label: formLabel, href: `/governance/forms/${params.type}/new` },
          { label: "2. 구축" },
        ]}
      />
      <h1 className="text-2xl font-bold tracking-tight">{formLabel} — 2. 구축</h1>
      <p className="mt-1.5 text-sm text-gray-500">
        업체 선정 · 계약 체결 · 데이터 수령 · 검수 단계.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-6 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
          <Construction size={22} />
        </div>
        <h2 className="mt-4 text-base font-bold">준비 중</h2>
        <p className="mt-1.5 max-w-md text-sm text-gray-500">
          이 단계는 별도 시스템(전자결재 후 외부 계약/검수) 에서 처리됩니다.
          DataHub 내 자동화는 추후 추가될 예정입니다.
        </p>
        <Link
          href={`/governance/forms/${params.type}/new`}
          className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
        >
          <ArrowLeft size={12} /> 1. 기획으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
