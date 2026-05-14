// 2단계 / 블록 1 — 계약 체결 현황 + EAS 외부 링크.
//   계약 정보를 회색 박스에 grid 로 나열, 하단에 외부 시스템 / 계약서 보기 버튼.

"use client";

import { ExternalLink, FileBadge, FileText } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";
import { PhaseStatusBadge } from "@/components/PhaseStatusBadge";

export interface ContractInfo {
  approvalNumber: string;
  vendor: string;
  amount: number;
  agreementIncluded: boolean;
  deliveryDeadline: string;
  totalRounds: number;
}

interface Props {
  contract: ContractInfo;
}

export function ContractStatusBlock({ contract }: Props) {
  const amountFmt = contract.amount.toLocaleString("ko-KR") + "원";

  const openEas = () => {
    const easUrl = `https://eas.example.com/approval/${contract.approvalNumber}`;
    // TODO: 실제 EAS 연동 시 window.open(easUrl, "_blank") 활성화.
    console.log("[stub] open EAS approval:", easUrl);
  };
  const openContract = () => {
    console.log("[stub] open 계약서");
  };

  return (
    <PhaseBlock
      icon={FileBadge}
      title="계약 체결 현황"
      trailing={<PhaseStatusBadge variant="success">체결 완료</PhaseStatusBadge>}
    >
      <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
        <dl
          className="grid gap-x-4 gap-y-1.5 text-sm"
          style={{ gridTemplateColumns: "auto 1fr" }}
        >
          <InfoRow label="EAS 품의번호" value={contract.approvalNumber} />
          <InfoRow label="계약 업체" value={contract.vendor} />
          <InfoRow label="계약 금액" value={amountFmt} />
          <InfoRow
            label="활용 협약"
            value={contract.agreementIncluded ? "✓ 계약서에 포함" : "별도 미포함"}
            valueClass={
              contract.agreementIncluded ? "text-green-700 dark:text-green-300" : ""
            }
          />
          <InfoRow
            label="납기"
            value={`${contract.deliveryDeadline} (총 ${contract.totalRounds}회차 분할 납품)`}
          />
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ActionButton icon={ExternalLink} label="EAS 품의 확인" onClick={openEas} />
        <ActionButton icon={FileText} label="계약서 보기" onClick={openContract} />
      </div>
    </PhaseBlock>
  );
}

function InfoRow({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <>
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className={`text-gray-900 dark:text-gray-100 ${valueClass}`}>{value}</dd>
    </>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </button>
  );
}
