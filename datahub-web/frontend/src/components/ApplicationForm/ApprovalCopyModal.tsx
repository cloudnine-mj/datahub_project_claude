// 추적 모드의 '전자결재 본문 복사' 모달 — 제출된 신청을 g portal 결재 본문에 붙여 넣을
//   평문 텍스트 형태로 노출. textarea readonly + monospace.
//   복사 후 모달은 자동으로 닫지 않음 (사용자가 직접 닫음).
//   하단 액션: [닫기] [텍스트 복사].

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
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

const MONO_STACK =
  "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

export function ApprovalCopyModal({
  type,
  payload,
  applicantName,
  applicantDepartment,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 모달 열리기 전 포커스된 요소 — 닫힐 때 포커스 복원.
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    // 텍스트 즉시 복사 가능하도록 textarea 에 포커스 (Cmd+A → Cmd+C 흐름).
    textareaRef.current?.focus();
    textareaRef.current?.select();

    // body 스크롤 락
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

  const text = generateApprovalText(type, payload, applicantName, applicantDepartment);

  const onCopy = async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("[approval-copy] failed", e);
      setError("복사 실패. 텍스트를 직접 선택해 복사해 주세요.");
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

        <p className="mb-[18px] text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          아래 텍스트를 복사하여 g portal 전자결재 품의서 본문에 붙여 넣으세요. (
          {APPLICATION_TYPE_LABEL[type]} 신청)
        </p>

        <textarea
          ref={textareaRef}
          readOnly
          value={text}
          aria-label="전자결재 본문 텍스트"
          style={{
            minHeight: 240,
            padding: "18px 22px",
            fontFamily: MONO_STACK,
            fontSize: 13,
            lineHeight: 1.9,
            resize: "none",
          }}
          className="w-full select-text rounded-lg border border-gray-200 bg-gray-50 text-gray-800 focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-800/40 dark:text-gray-200"
        />

        {(copied || error) && (
          <div
            aria-live="polite"
            className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${
              copied
                ? "text-green-700 dark:text-green-300"
                : "text-red-700 dark:text-red-300"
            }`}
          >
            {copied && <Check size={12} aria-hidden="true" />}
            {copied ? "복사되었습니다. g portal에 붙여 넣으세요." : error}
          </div>
        )}

        <div className="mt-[18px] flex items-center justify-end gap-2">
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-5 py-2 text-[13px] font-medium text-red-700 transition hover:brightness-95 dark:bg-red-900/30 dark:text-red-300"
          >
            <Copy size={14} aria-hidden="true" />
            텍스트 복사
          </button>
        </div>
      </div>
    </div>
  );
}
