"use client";

// 신청서 미리보기 모달 — detail 페이지 / FormBuilder 작성 중 양쪽에서 공용.
// 전자결재 본문 에디터에 붙여넣을 HTML 표를 보여주고, '복사하기' 로
// HTML + plain text 를 클립보드에 함께 넣음.

import { X } from "lucide-react";
import {
  buildPreviewHtml,
  buildPreviewPlainText,
  type PreviewData,
} from "@/lib/formPreview";

export function FormPreviewModal({
  data,
  copyDone,
  onCopy,
  onClose,
}: {
  data: PreviewData;
  copyDone: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold">제출할 문서 미리보기</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              아래 표를 복사한 뒤 전자결재 본문 에디터에 붙여넣으면 서식 그대로 들어갑니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="max-h-[60vh] overflow-auto px-6 py-5"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: buildPreviewHtml(data) }}
        />

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            {copyDone ? "복사됨!" : "복사하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 클립보드 복사 헬퍼 — HTML + plain text 둘 다 넣고, ClipboardItem 미지원 환경은 text fallback. */
export async function copyPreviewToClipboard(data: PreviewData): Promise<void> {
  const html = buildPreviewHtml(data);
  const text = buildPreviewPlainText(data);
  if (typeof ClipboardItem !== "undefined") {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(text);
}
