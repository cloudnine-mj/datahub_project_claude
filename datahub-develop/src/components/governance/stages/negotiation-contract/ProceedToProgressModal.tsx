// 진행 단계 전환 모달 — [진행 단계로] 클릭 시 오픈. 두 섹션(최종 협의 내용 4필드 / 계약 정보 1필드)
//   을 분리 표시하고, 5필드를 모두 확인. 모달 안에서도 인라인 편집 가능(빈칸 클릭 → input).
//   - 미입력 존재: 경고 배너 + 진행 버튼 비활성.
//   - 모두 입력: 완료 배너 + 진행 버튼 활성.
// 진행 확정은 onProceed. 자동 전환 금지 — 이 버튼 외 어떤 경로로도 협의→진행 전환하지 않는다.

"use client";

import { useEffect } from "react";
import { AlertTriangle, ArrowRight, CircleCheck, X } from "lucide-react";
import {
  formatAmount,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import { InlineCell } from "./InlineCell";

interface FieldConfig {
  key: NegotiationField;
  label: string;
  format?: (v: string) => string;
}

const AGREEMENT_FIELDS: readonly FieldConfig[] = [
  { key: "selectedVendor", label: "선정 업체" },
  { key: "amount", label: "금액", format: formatAmount },
  { key: "period", label: "작업 기간" },
  { key: "workCount", label: "작업 건수" },
];

interface Props {
  negotiation: NegotiationResult;
  contractNo: string;
  onAgreementField: (key: NegotiationField, next: string) => void;
  onContractField: (next: string) => void;
  onProceed: () => void;
  onClose: () => void;
}

export function ProceedToProgressModal({
  negotiation,
  contractNo,
  onAgreementField,
  onContractField,
  onProceed,
  onClose,
}: Props) {
  const emptyAgreement = AGREEMENT_FIELDS.filter(
    (f) => negotiation[f.key].trim().length === 0,
  ).length;
  const emptyContract = contractNo.trim().length === 0 ? 1 : 0;
  const emptyCount = emptyAgreement + emptyContract;
  const anyEmpty = emptyCount > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="proceed-progress-title"
    >
      <div
        className="w-full max-w-[480px] rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[18px] py-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3
            id="proceed-progress-title"
            className="text-[14px] font-medium text-gray-900 dark:text-gray-100"
          >
            진행 단계로
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <p className="mb-3 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
          최종 협의 내용과 계약 정보를 확인해 주세요. 진행 단계에서 참조됩니다.
        </p>

        {/* 섹션 1 — 최종 협의 내용 */}
        <SectionTitle>최종 협의 내용</SectionTitle>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
          <table className="w-full text-[12px]">
            <tbody>
              {AGREEMENT_FIELDS.map((f, i) => {
                const isEmpty = negotiation[f.key].trim().length === 0;
                return (
                  <ModalRow
                    key={f.key}
                    label={f.label}
                    isEmpty={isEmpty}
                    isLast={i === AGREEMENT_FIELDS.length - 1}
                  >
                    <InlineCell
                      value={negotiation[f.key]}
                      emptyEditable="입력 필요"
                      format={f.format}
                      onCommit={(next) => onAgreementField(f.key, next)}
                    />
                  </ModalRow>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 섹션 사이 간격 */}
        <div className="h-[14px]" />

        {/* 섹션 2 — 계약 정보 (EAS) */}
        <SectionTitle>계약 정보 (EAS)</SectionTitle>
        <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
          <table className="w-full text-[12px]">
            <tbody>
              <ModalRow label="품의번호" isEmpty={emptyContract === 1} isLast>
                <InlineCell
                  value={contractNo}
                  emptyEditable="입력 필요"
                  onCommit={onContractField}
                />
              </ModalRow>
            </tbody>
          </table>
        </div>

        {anyEmpty ? (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed"
            style={{ background: "#FAEEDA", color: "#854F0B" }}
          >
            <AlertTriangle size={14} aria-hidden="true" className="mt-px shrink-0" />
            <span>
              {emptyCount}개 항목이 비어 있습니다. 진행 단계로 넘기려면 모두 입력해 주세요.
            </span>
          </div>
        ) : (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <CircleCheck size={14} aria-hidden="true" className="mt-px shrink-0" />
            <span>모든 항목이 입력되었습니다. 진행 시 채팅에 단계 구분선이 추가됩니다.</span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border-[0.5px] border-[var(--color-border-secondary,#d1d5db)] bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onProceed}
            disabled={anyEmpty}
            className={
              anyEmpty
                ? "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-[var(--color-background-secondary,#f3f4f6)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--color-text-tertiary,#9ca3af)]"
                : "inline-flex items-center gap-1.5 rounded-md bg-[#D4533E] px-3.5 py-1.5 text-[12px] font-medium text-white transition hover:brightness-110"
            }
          >
            진행 단계로
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
      <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
        {children}
      </span>
    </div>
  );
}

function ModalRow({
  label,
  isEmpty,
  isLast,
  children,
}: {
  label: string;
  isEmpty: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr
      className={
        isLast
          ? ""
          : "border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)]"
      }
      style={isEmpty ? { background: "#FCF8EF" } : undefined}
    >
      <td
        className="w-[110px] px-3 py-[9px] align-middle text-gray-500 dark:text-gray-400"
        style={{
          background: isEmpty
            ? "#FCF8EF"
            : "var(--color-background-secondary,#f9fafb)",
        }}
      >
        {label}
        {isEmpty && (
          <span aria-hidden="true" className="ml-0.5 text-[#D4533E]">
            *
          </span>
        )}
      </td>
      <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
        {children}
      </td>
    </tr>
  );
}
