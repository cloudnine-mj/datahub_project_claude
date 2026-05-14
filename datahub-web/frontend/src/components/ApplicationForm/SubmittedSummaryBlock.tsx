// 제출된 신청 내용 카드 — 유형별 주요 4개 필드만 요약 표.
//   '전체 보기' 버튼으로 양식 전체는 별도 모달/페이지 확인 (현재 stub).

"use client";

import { Eye } from "lucide-react";
import type { ApplicationType } from "@/lib/applicationFormConfig";

interface SummaryField {
  id: string;
  label: string;
  /** 실데이터 미연동 단계 — 시안 검증용 mock value. */
  mockValue: string;
}

const SUMMARY_FIELDS: Record<ApplicationType, SummaryField[]> = {
  service: [
    { id: "applicant", label: "신청자", mockValue: "김데이터 (AI Platform)" },
    { id: "dataName", label: "데이터명", mockValue: "한국어 도메인 특화 음성 코퍼스" },
    { id: "quantity", label: "제작 수량", mockValue: "20,000건" },
    { id: "cost", label: "예상 비용", mockValue: "16,500,000원" },
  ],
  purchase: [
    { id: "applicant", label: "신청자", mockValue: "김데이터 (AI Platform)" },
    { id: "dataName", label: "데이터명", mockValue: "공개 코퍼스 라이선스" },
    { id: "period", label: "필요 기간", mockValue: "1회성 구매" },
    { id: "cost", label: "예상 비용", mockValue: "8,000,000원" },
  ],
  subscribe: [
    { id: "applicant", label: "신청자", mockValue: "김데이터 (AI Platform)" },
    { id: "dataName", label: "데이터명", mockValue: "뉴스 코퍼스 월간 구독" },
    { id: "period", label: "필요 기간", mockValue: "월 정기 · 12개월" },
    { id: "cost", label: "예상 비용", mockValue: "2,400,000원" },
  ],
};

interface Props {
  type: ApplicationType;
  values: Record<string, string>;
}

export function SubmittedSummaryBlock({ type, values }: Props) {
  const fields = SUMMARY_FIELDS[type];

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">제출된 신청 내용</h2>
        <button
          type="button"
          onClick={() => console.log("[stub] 전체 보기")}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Eye size={12} aria-hidden="true" />
          전체 보기
        </button>
      </header>

      <dl className="divide-y divide-gray-100 dark:divide-gray-800">
        {fields.map((f) => (
          <div
            key={f.id}
            className="grid grid-cols-[120px_1fr] gap-3 py-3 first:pt-1 last:pb-1"
          >
            <dt className="text-sm text-gray-500 dark:text-gray-400">{f.label}</dt>
            <dd className="text-sm text-gray-900 dark:text-gray-100">
              {values[f.id]?.trim() || f.mockValue}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
