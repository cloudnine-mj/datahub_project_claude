// 계약 체결 단계 body (current 상태) — 품의번호 입력 + 활용 협약 체크박스.
//   완료 조건: 품의번호 비어있지 않음 + 활용 협약 체크.

"use client";

import type { ContractStep } from "./useBuildPhase";

interface Props {
  contract: ContractStep;
  onChangeApprovalNumber: (v: string) => void;
  onToggleAgreement: () => void;
  onConfirm: () => void;
}

export function ContractStepBody({
  contract,
  onChangeApprovalNumber,
  onToggleAgreement,
  onConfirm,
}: Props) {
  return (
    <>
      <div>
        <label
          htmlFor="approval-number"
          className="mb-1 block text-xs text-gray-500 dark:text-gray-400"
        >
          계약품의 품의번호
        </label>
        <div className="flex gap-2">
          <input
            id="approval-number"
            type="text"
            value={contract.approvalNumber}
            onChange={(e) => onChangeApprovalNumber(e.target.value)}
            placeholder="예: P-2026-0331"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-[13px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => {
              if (!contract.approvalNumber.trim()) return;
              console.log("[stub] 계약 체결 확인", contract.approvalNumber);
              onConfirm();
            }}
            className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            계약 체결 확인
          </button>
        </div>
      </div>

      <label
        htmlFor="agreement-confirmed"
        className="flex cursor-pointer items-start gap-2.5 rounded-md bg-gray-50 px-3 py-2 transition hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800"
      >
        <input
          id="agreement-confirmed"
          type="checkbox"
          checked={contract.agreementConfirmed}
          onChange={onToggleAgreement}
          className="mt-[2px] h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand focus:ring-brand"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-gray-800 dark:text-gray-200">
            데이터 활용 협약 체결
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            별도 협약 체결 또는 계약서에 활용 협약 조항 포함
          </p>
        </div>
      </label>
    </>
  );
}
