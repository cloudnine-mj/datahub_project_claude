// 2단계 / 블록 1 — 계약 체결 확인.
//   품의번호 입력 + '계약 체결 확인' 버튼 + 활용 협약 체크박스.

"use client";

import { useState } from "react";
import { FileBadge } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseChecklistRow } from "@/components/PhaseChecklistRow";

export function ContractConfirmBlock() {
  const [approvalNumber, setApprovalNumber] = useState("");
  const [agreementChecked, setAgreementChecked] = useState(false);

  const confirmContract = () => {
    if (!approvalNumber.trim()) return;
    console.log("[stub] 계약 체결 확인:", approvalNumber);
  };

  return (
    <PhaseBlock icon={FileBadge} title="계약 체결 확인">
      <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
        계약품의 품의번호를 입력하면 계약 체결 여부가 확인됩니다. 데이터 활용 협약은
        별도 협약 또는 계약서에 포함되어야 합니다.
      </p>

      <div className="mb-3">
        <label
          htmlFor="approval-number"
          className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300"
        >
          계약품의 품의번호
        </label>
        <div className="flex gap-2">
          <input
            id="approval-number"
            type="text"
            value={approvalNumber}
            onChange={(e) => setApprovalNumber(e.target.value)}
            placeholder="예: P-2026-0331"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={confirmContract}
            className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            계약 체결 확인
          </button>
        </div>
      </div>

      <PhaseChecklistRow
        id="contract-agreement"
        label="데이터 활용 협약이 체결되었다"
        description="별도 협약 체결 또는 계약서에 활용 협약 조항 포함"
        checked={agreementChecked}
        onToggle={() => setAgreementChecked((v) => !v)}
      />
    </PhaseBlock>
  );
}
