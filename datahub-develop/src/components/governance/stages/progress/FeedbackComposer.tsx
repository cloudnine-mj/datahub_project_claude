// 피드백 작성 영역 — 최신 데이터 검토 카드 안에서 인라인 노출.
//   텍스트 + 다중 첨부. 둘 다 비어 있으면 전송 비활성. 전송 시 부모가 piece 데이터 받아 저장.

"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, Plus, Send, X } from "lucide-react";
import {
  deliveryColors,
  deliveryLabel,
  formatBytes,
  type DeliveryRound,
  type FeedbackAttachmentMeta,
} from "@/lib/governance/progress-storage";

interface Props {
  targetDeliveryRound: DeliveryRound;
  targetVersion: number;
  onCancel: () => void;
  onSubmit: (payload: {
    content: string;
    attachments: FeedbackAttachmentMeta[];
  }) => void;
}

export function FeedbackComposer({
  targetDeliveryRound,
  targetVersion,
  onCancel,
  onSubmit,
}: Props) {
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<FeedbackAttachmentMeta[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // ESC 로 취소.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  function onPickFiles(picked: FileList | null): void {
    if (!picked || picked.length === 0) return;
    const next: FeedbackAttachmentMeta[] = [];
    const list = Array.from(picked);
    list.forEach((f) => {
      next.push({ name: f.name, size: f.size, type: f.type });
    });
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const canSend = content.trim().length > 0 || files.length > 0;
  const dc = deliveryColors(targetDeliveryRound);

  function submit(): void {
    if (!canSend) return;
    onSubmit({ content: content.trim(), attachments: files });
  }

  return (
    <div className="mt-3 rounded-md border-[0.5px] border-[#EFC4B9] bg-white p-3 dark:bg-gray-900">
      <header className="mb-2 flex items-center gap-1.5">
        <span aria-hidden="true" className="block h-3 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h4 className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
          피드백 작성
        </h4>
        <span
          className="inline-flex items-center text-[9px] font-medium"
          style={{ background: dc.bg, color: dc.text, borderRadius: 4, padding: "2px 6px" }}
        >
          {deliveryLabel(targetDeliveryRound)} v{targetVersion} 대상
        </span>
      </header>

      <label className="mb-1 block text-[10px] text-gray-500 dark:text-gray-400">
        피드백 내용
      </label>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="텍스트를 직접 작성하거나, 아래에서 문서를 첨부하거나, 둘 다 사용할 수 있습니다."
        className="mb-2 w-full resize-none overflow-y-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        style={{ minHeight: "90px" }}
      />

      <div className="mb-1.5 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
        <Paperclip size={11} aria-hidden="true" />
        첨부 파일
        <span className="text-[9px] text-[var(--color-text-tertiary,#9ca3af)]">
          (엑셀, 워드, PDF, 이미지 등)
        </span>
      </div>
      {files.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1.5"
              style={{
                background: "var(--color-background-secondary,#f3f4f6)",
                borderRadius: 5,
                padding: "5px 9px",
              }}
            >
              <Paperclip size={10} aria-hidden="true" className="text-gray-500" />
              <span className="text-[10px] text-gray-800 dark:text-gray-100">{f.name}</span>
              <span className="text-[10px] text-gray-400">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label={`${f.name} 제거`}
                className="rounded-sm p-0.5 text-gray-400 transition hover:text-red-600"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-1 rounded-md border-[0.5px] border-dashed border-[var(--color-border-secondary,#d1d5db)] px-2.5 py-1 text-[10px] text-gray-600 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
      >
        <Plus size={10} aria-hidden="true" /> 파일 추가
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => onPickFiles(e.target.files)}
      />

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-2.5 dark:border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className={
            canSend
              ? "inline-flex items-center gap-1.5 rounded-md bg-[#D4533E] px-3 py-1.5 text-[11px] font-medium text-white transition hover:brightness-110"
              : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-[var(--color-background-secondary,#f3f4f6)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-tertiary,#9ca3af)]"
          }
        >
          <Send size={12} aria-hidden="true" /> 피드백 전송
        </button>
      </div>
    </div>
  );
}
