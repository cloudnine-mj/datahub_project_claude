// 제출된 신청 내용 카드 — 유형별 주요 4개 필드만 요약 표.
//   '미리보기' 버튼으로 양식 전체는 모달(ApplicationPreviewModal) 노출.
//   필드 라벨은 FORM_SCHEMAS 와 동일하게 맞춤, 값은 MOCK_SUBMITTED_PAYLOAD 에서 가져옴.

"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import {
  MOCK_SUBMITTED_PAYLOAD,
  type ApplicationType,
} from "@/lib/applicationFormConfig";
import { ApplicationPreviewModal } from "./ApplicationPreviewModal";

interface SummaryRow {
  /** FORM_SCHEMAS 의 field key. */
  key: string;
  label: string;
}

/** 유형별 요약 카드에서 노출할 핵심 4개 필드. FORM_SCHEMAS key 와 일치해야 함. */
const SUMMARY_ROWS: Record<ApplicationType, SummaryRow[]> = {
  purchase: [
    { key: "프로젝트명", label: "프로젝트명" },
    { key: "구매_희망_데이터셋", label: "구매 희망 데이터셋" },
    { key: "판매_업체", label: "판매 업체" },
    { key: "사용_예상_금액", label: "사용 예상 금액 (예산)" },
  ],
  subscribe: [
    { key: "프로젝트명", label: "프로젝트명" },
    { key: "구독_희망_데이터셋", label: "구독 희망 데이터셋" },
    { key: "구독_기간", label: "구독 기간" },
    { key: "월_사용_예상_금액", label: "월 사용 예상 금액" },
  ],
  service: [
    { key: "관련_프로젝트_PMS", label: "관련 프로젝트 (PMS 기준)" },
    { key: "데이터셋_이름", label: "데이터셋 이름" },
    { key: "목표_데이터_수량", label: "목표 데이터 수량" },
    { key: "희망_수령일", label: "희망 수령일" },
  ],
};

const APPLICANT_LABEL = "김데이터 (AI Platform)";

interface Props {
  type: ApplicationType;
}

export function SubmittedSummaryBlock({ type }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const rows = SUMMARY_ROWS[type];
  const payload = MOCK_SUBMITTED_PAYLOAD[type];

  return (
    <>
      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">제출된 신청 내용</h2>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Eye size={12} aria-hidden="true" />
            미리보기
          </button>
        </header>

        <dl className="divide-y divide-gray-100 dark:divide-gray-800">
          <div className="grid grid-cols-[120px_1fr] gap-3 py-3 first:pt-1">
            <dt className="text-sm text-gray-500 dark:text-gray-400">신청자</dt>
            <dd className="text-sm text-gray-900 dark:text-gray-100">{APPLICANT_LABEL}</dd>
          </div>
          {rows.map((r) => {
            const v = payload[r.key];
            const text =
              v == null || v === "" ? "—" : typeof v === "string" ? v : String(v);
            return (
              <div
                key={r.key}
                className="grid grid-cols-[120px_1fr] gap-3 py-3 last:pb-1"
              >
                <dt className="text-sm text-gray-500 dark:text-gray-400">{r.label}</dt>
                <dd className="text-sm text-gray-900 dark:text-gray-100">{text}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      {previewOpen && (
        <ApplicationPreviewModal type={type} onClose={() => setPreviewOpen(false)} />
      )}
    </>
  );
}
