// 진행 단계 전환 모달 — [진행 단계로] 클릭 시 오픈.
//
// 품의번호를 최종 확인. 모달 안에서도 인라인 편집 가능(빈칸 클릭 → input).
//   - 미입력: 경고 배너 + 진행 버튼 비활성.
//   - 입력 완료: 완료 배너 + 진행 버튼 활성.
// 진행 확정은 onProceed(부모 onProceedToProgress). 5단계 자동 전환 금지 — 이 버튼 외
//   어떤 경로로도 계약→진행 전환하지 않는다.

"use client";

import { useEffect } from "react";
import { AlertTriangle, ArrowRight, CircleCheck, X } from "lucide-react";
import { AgreementCell } from "../negotiation/AgreementResultCard";

interface Props {
  value: string;
  onField: (next: string) => void;
  onProceed: () => void;
  onClose: () => void;
}

export function ProceedToProgressModal({
  value,
  onField,
  onProceed,
  onClose,
}: Props) {
  const isEmpty = value.trim().length === 0;

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
        className="w-full max-w-[440px] rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[18px] py-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
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
          계약 정보를 최종 확인해 주세요. 진행 단계에서 참조됩니다.
        </p>

        <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
          <table className="w-full text-[12px]">
            <tbody>
              <tr style={isEmpty ? { background: "#FCF8EF" } : undefined}>
                <td
                  className="w-[100px] px-3 py-[9px] align-middle text-gray-500 dark:text-gray-400"
                  style={{
                    background: isEmpty
                      ? "#FCF8EF"
                      : "var(--color-background-secondary,#f9fafb)",
                  }}
                >
                  품의번호
                  {isEmpty && (
                    <span aria-hidden="true" className="ml-0.5 text-[#D4533E]">
                      *
                    </span>
                  )}
                </td>
                <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
                  <AgreementCell
                    value={value}
                    canEdit
                    emptyEditable="입력 필요"
                    onCommit={onField}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {isEmpty ? (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed"
            style={{ background: "#FAEEDA", color: "#854F0B" }}
          >
            <AlertTriangle size={14} aria-hidden="true" className="mt-px shrink-0" />
            <span>품의번호가 비어 있습니다. 진행 단계로 넘기려면 입력해 주세요.</span>
          </div>
        ) : (
          <div
            className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-relaxed"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <CircleCheck size={14} aria-hidden="true" className="mt-px shrink-0" />
            <span>입력이 완료되었습니다. 진행 시 채팅에 단계 구분선이 추가됩니다.</span>
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
            disabled={isEmpty}
            className={
              isEmpty
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
