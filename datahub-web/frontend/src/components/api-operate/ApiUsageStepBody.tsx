// 2단계 · API 활용 — current 상태 body.
//   사용 시작일(date) + 결제 수단(text + 안내). 외부 시스템에서 일어나는 일이므로
//   Datahub 안에서는 두 정보만 확인 입력받는다.

"use client";

import type { ApiUsageStep } from "./useOperatePhase";

interface Props {
  apiUsage: ApiUsageStep;
  onChangeStartDate: (v: string) => void;
  onChangePaymentMethod: (v: string) => void;
}

export function ApiUsageStepBody({
  apiUsage,
  onChangeStartDate,
  onChangePaymentMethod,
}: Props) {
  return (
    <div className="space-y-3">
      <Row label="사용 시작일">
        <input
          type="date"
          value={apiUsage.startDate}
          onChange={(e) => onChangeStartDate(e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px] focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
      </Row>
      <Row label="결제 수단">
        <input
          type="text"
          value={apiUsage.paymentMethod}
          onChange={(e) => onChangePaymentMethod(e.target.value)}
          placeholder="개인 법인카드 (****-1234)"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px] placeholder:text-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
          API 비용은 개인 법인카드로 결제합니다.
        </p>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-start gap-3">
      <span className="pt-1.5 text-[12px] text-gray-500 dark:text-gray-400">{label}</span>
      <div>{children}</div>
    </div>
  );
}
