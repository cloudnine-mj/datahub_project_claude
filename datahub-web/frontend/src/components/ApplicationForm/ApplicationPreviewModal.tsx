// 제출된 신청서 미리보기 모달 — EAS 본문 에디터에 그대로 붙여넣을 수 있는 HTML 표 형태.
//   추적 모드 전용 (draft 모드는 FormBuilder 자체 미리보기 사용).
//   값은 데모용 MOCK_SUBMITTED_PAYLOAD 에서 가져옴 — 실 API 연동 시 type 외에 values 도 prop 으로 받도록 확장.

"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from "@/lib/applicationFormConfig";
import {
  buildApplicationPreviewHtml,
  copyApplicationPreviewToClipboard,
} from "@/lib/applicationPreview";

interface Props {
  type: ApplicationType;
  onClose: () => void;
}

export function ApplicationPreviewModal({ type, onClose }: Props) {
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const html = buildApplicationPreviewHtml(type);

  const onCopy = async () => {
    try {
      await copyApplicationPreviewToClipboard(type);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 1500);
    } catch (e) {
      console.error("[preview] 복사 실패", e);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="신청서 미리보기"
    >
      <div
        className="w-full max-w-3xl rounded-lg bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-base font-medium text-gray-900 dark:text-gray-100">
              제출할 문서 미리보기
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              아래 표를 복사한 뒤 EAS 본문 에디터에 붙여넣으면 서식 그대로 들어갑니다.
              ({APPLICATION_TYPE_LABEL[type]} 신청)
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
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
          >
            {copyDone ? "복사됨!" : "복사하기"}
          </button>
        </footer>
      </div>
    </div>
  );
}
