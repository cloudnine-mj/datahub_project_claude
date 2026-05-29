// 계약 단계 전환 모달 — 담당자가 [계약 단계로 진행] 클릭 시 오픈.
//
// 최종 협의 내용 4필드를 최종 확인. 모달 안에서도 인라인 편집 가능(빈칸 클릭 → input).
//   - 미입력 항목 존재: 경고 배너 + 진행 버튼 비활성.
//   - 모두 입력: 완료 배너 + 진행 버튼 활성.
// 진행 확정은 onProceed (부모 onProceedToContract) 가 담당. 5단계 자동 전환 금지 —
//   이 버튼 외 어떤 경로로도 협의→계약 전환하지 않는다.

"use client";

import { useEffect } from "react";
import { AlertTriangle, ArrowRight, CircleCheck, X } from "lucide-react";
import {
  emptyFields,
  formatAmount,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import { AgreementCell } from "./AgreementResultCard";

interface FieldConfig {
  key: NegotiationField;
  label: string;
  format?: (v: string) => string;
}

const FIELD_CONFIG: readonly FieldConfig[] = [
  { key: "selectedVendor", label: "선정 업체" },
  { key: "amount", label: "금액", format: formatAmount },
  { key: "period", label: "작업 기간" },
  { key: "workCount", label: "작업 건수" },
];

interface Props {
  value: NegotiationResult;
  onField: (key: NegotiationField, next: string) => void;
  onProceed: () => void;
  onClose: () => void;
}

export function ProceedToContractModal({
  value,
  onField,
  onProceed,
  onClose,
}: Props) {
  const empties = emptyFields(value);
  const anyEmpty = empties.length > 0;

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
      aria-labelledby="proceed-contract-title"
    >
      <div
        className="w-full max-w-[440px] rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[18px] py-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3
            id="proceed-contract-title"
            className="text-[14px] font-medium text-gray-900 dark:text-gray-100"
          >
            계약 단계로 진행
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
          최종 협의 내용을 최종 확인해 주세요. 계약·진행 단계에서 참조됩니다.
        </p>

        <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
          <table className="w-full text-[12px]">
            <tbody>
              {FIELD_CONFIG.map((f, i) => {
                const isEmpty = value[f.key].trim().length === 0;
                return (
                  <tr
                    key={f.key}
                    className={
                      i < FIELD_CONFIG.length - 1
                        ? "border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)]"
                        : ""
                    }
                    style={isEmpty ? { background: "#FCF8EF" } : undefined}
                  >
                    <td
                      className="w-[100px] px-3 py-[9px] align-middle text-gray-500 dark:text-gray-400"
                      style={{
                        background: isEmpty
                          ? "#FCF8EF"
                          : "var(--color-background-secondary,#f9fafb)",
                      }}
                    >
                      {f.label}
                      {isEmpty && (
                        <span
                          aria-hidden="true"
                          className="ml-0.5 text-[#D4533E]"
                        >
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
                      <AgreementCell
                        value={value[f.key]}
                        canEdit
                        emptyEditable="입력 필요"
                        format={f.format}
                        onCommit={(next) => onField(f.key, next)}
                      />
                    </td>
                  </tr>
                );
              })}
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
              {empties.length}개 항목이 비어 있습니다. 계약 단계로 진행하려면 모두 입력해 주세요.
            </span>
          </div>
        ) : (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <CircleCheck size={14} aria-hidden="true" className="mt-px shrink-0" />
            <span>
              모든 항목이 입력되었습니다. 진행 시 채팅에 단계 구분선이 추가됩니다.
            </span>
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
            계약 단계로 진행
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
