// 작성 모드의 '제출 전 검토' 모달 — draft 사용자가 신청서 제출 직전 양식을 표 형태로 최종 확인.
//   복사 기능 없음 (양식이 화면에 그대로 있어 복사가 의미 없음).
//   하단 액션: [닫기] [신청서 제출 →].

"use client";

import { useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import {
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from "@/lib/applicationFormConfig";
import { buildApplicationPreviewHtml } from "@/lib/applicationPreview";

interface Props {
  type: ApplicationType;
  onClose: () => void;
  onConfirmSubmit: () => void;
}

export function PreSubmitPreviewModal({ type, onClose, onConfirmSubmit }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const html = buildApplicationPreviewHtml(type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="제출 전 검토"
    >
      <div
        className="w-full max-w-3xl rounded-lg bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
              제출 전 검토
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              입력한 내용을 확인한 뒤 제출하세요. ({APPLICATION_TYPE_LABEL[type]} 신청)
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

        <div
          className="max-h-[60vh] overflow-auto bg-white px-6 py-5 dark:bg-gray-950"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <footer className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onConfirmSubmit}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
          >
            신청서 제출
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </footer>
      </div>
    </div>
  );
}
