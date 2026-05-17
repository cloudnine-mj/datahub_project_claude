// 추적 모드의 '전자결재 본문 복사' 모달 — 제출된 신청을 g portal 결재 본문에 붙여 넣을
//   평문 텍스트 형태로 노출. textarea readonly + monospace.
//   복사 후 모달은 자동으로 닫지 않음 (사용자가 직접 닫음).
//   하단 액션: [닫기] [텍스트 복사].

"use client";

import { useEffect, useState } from "react";
import { Copy, X } from "lucide-react";
import {
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from "@/lib/applicationFormConfig";
import { generateApprovalText } from "@/lib/applicationPreview";

interface Props {
  type: ApplicationType;
  payload: Record<string, unknown>;
  applicantName: string;
  applicantDepartment: string;
  onClose: () => void;
}

export function ApprovalCopyModal({
  type,
  payload,
  applicantName,
  applicantDepartment,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const text = generateApprovalText(type, payload, applicantName, applicantDepartment);

  const onCopy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("[approval-copy] failed", e);
      setError("복사 실패. 직접 텍스트를 선택해 복사해 주세요");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="전자결재 본문 복사"
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
              전자결재 본문 복사
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              아래 텍스트를 복사하여 g portal 전자결재 품의서 본문에 붙여 넣으세요. (
              {APPLICATION_TYPE_LABEL[type]} 신청)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="px-6 py-4">
          <textarea
            readOnly
            value={text}
            aria-label="결재 본문 텍스트"
            className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-xs leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-200"
            style={{ minHeight: 220 }}
          />
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-800">
          <p
            aria-live="polite"
            className={`text-xs font-medium ${
              copied
                ? "text-green-700 dark:text-green-300"
                : error
                ? "text-red-700 dark:text-red-300"
                : "text-transparent"
            }`}
          >
            {error
              ? error
              : copied
              ? "복사되었습니다. g portal에 붙여 넣으세요"
              : "복사 안내"}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
            >
              <Copy size={14} aria-hidden="true" />
              텍스트 복사
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
