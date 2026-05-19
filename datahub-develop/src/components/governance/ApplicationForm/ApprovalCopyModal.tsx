// 전자결재 본문 복사 모달 — 결재 본문 데이터(ApprovalData) 를 G Portal 품의서
//   rich editor 에 붙여 넣을 수 있도록 표 형태로 노출. 복사 시 HTML(text/html) +
//   평문(text/plain) 두 형태를 클립보드에 함께 적재.
//   데이터 빌드는 호출 측에서 buildApprovalData / buildApiApprovalData 등으로 수행.

"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Info, X } from "lucide-react";
import {
  generateApprovalHtml,
  generateApprovalText,
  type ApprovalData,
} from "@/lib/governance/forms/application-preview";

interface Props {
  data: ApprovalData;
  onClose: () => void;
  /** 제공 시 복사 성공 후 자동으로 호출 — 다음 단계로 이동. */
  onProceedNext?: () => void;
}

export function ApprovalCopyModal({ data, onClose, onProceedNext }: Props) {
  const [error, setError] = useState<string | null>(null);
  // 모달 열리기 전 포커스된 요소 — 닫힐 때 포커스 복원.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  const html = generateApprovalHtml(data);
  const plain = generateApprovalText(data);

  const onCopy = async () => {
    setError(null);
    try {
      // rich editor 가 표를 그대로 받을 수 있도록 text/html + text/plain 동시 적재.
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([plain], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plain);
      }
    } catch (e) {
      console.error("[approval-copy] failed", e);
      setError("복사 실패. 표를 직접 선택해 복사해 주세요.");
      return;
    }
    if (onProceedNext) {
      setTimeout(() => onProceedNext(), 250);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-copy-title"
    >
      <div
        className="w-full max-w-[640px] rounded-xl bg-white px-7 pt-6 pb-5 shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2
            id="approval-copy-title"
            className="text-[17px] font-medium text-gray-900 dark:text-gray-100"
          >
            전자결재 본문 복사
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div
          role="note"
          className="mb-[14px] flex items-start gap-2.5 rounded-lg bg-blue-50 px-3.5 py-3 dark:bg-blue-950/40"
        >
          <Info
            size={16}
            aria-hidden="true"
            className="mt-px shrink-0 text-blue-700 dark:text-blue-300"
          />
          <span className="text-[13px] leading-relaxed text-blue-700 dark:text-blue-300">
            아래 표를 복사하여{" "}
            <strong className="font-medium">G Portal 전자결재 품의서 본문</strong>에 붙여 넣으세요.
            <br />
            <strong className="font-medium">[전자결재 본문 복사]</strong> 버튼을 누르면 자동으로 다음 단계인 전자결재 품의로 이동합니다.
          </span>
        </div>

        <div className="max-h-[420px] overflow-auto rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/40">
          <p className="mb-3 text-[13px] font-medium text-gray-900 dark:text-gray-100">
            [{data.title}]
          </p>
          <table className="w-full border-collapse text-[13px]">
            <tbody>
              {data.rows.map((r, idx) => (
                <tr key={`${r.label}-${idx}`}>
                  <th
                    scope="row"
                    className="w-[140px] whitespace-nowrap border border-gray-200 bg-white px-3 py-1.5 text-left font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    {r.label}
                  </th>
                  <td className="border border-gray-200 bg-white px-3 py-1.5 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                    {r.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && (
          <div
            aria-live="polite"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <div className="mt-[18px] flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark"
          >
            <Copy size={14} aria-hidden="true" />
            전자결재 본문 복사
          </button>
        </div>
      </div>
    </div>
  );
}
