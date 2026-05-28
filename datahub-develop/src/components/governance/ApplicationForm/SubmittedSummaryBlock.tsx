// 제출된 신청 내용 카드 — 유형별 주요 4개 필드 요약 + '결재 본문 복사' 버튼.
//   클릭 시 상위 컨테이너의 ApprovalCopyModal 을 트리거 (모달 자체는 컨테이너가 보유).
//   실 입력값(values) 이 전달되면 우선 사용, 없으면 MOCK_SUBMITTED_PAYLOAD 로 fallback.

"use client";

import {
  MOCK_SUBMITTED_PAYLOAD,
  type ApplicationType,
} from "@/lib/governance/forms/application-config";

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

interface Props {
  type: ApplicationType;
  /** 실 입력값 — 비어있으면 MOCK_SUBMITTED_PAYLOAD 로 fallback. */
  values?: Record<string, unknown>;
  applicant?: { name: string; department: string };
}

export function SubmittedSummaryBlock({
  type,
  values,
  applicant = { name: "김데이터", department: "AI Platform" },
}: Props) {
  const rows = SUMMARY_ROWS[type];
  const mock = MOCK_SUBMITTED_PAYLOAD[type];
  // 실 입력값 우선 — 누락 키는 mock 로 채움.
  const effective: Record<string, unknown> = { ...mock, ...(values ?? {}) };

  const applicantLabel = applicant.department
    ? `${applicant.name} (${applicant.department})`
    : applicant.name;

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center">
        <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
          제출된 신청 내용
        </h2>
      </header>

      <dl className="divide-y divide-gray-100 dark:divide-gray-800">
        <div className="grid grid-cols-[120px_1fr] gap-3 py-3 first:pt-1">
          <dt className="text-sm text-gray-500 dark:text-gray-400">신청자</dt>
          <dd className="text-sm text-gray-900 dark:text-gray-100">{applicantLabel}</dd>
        </div>
        {rows.map((r) => {
          const v = effective[r.key];
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
  );
}
