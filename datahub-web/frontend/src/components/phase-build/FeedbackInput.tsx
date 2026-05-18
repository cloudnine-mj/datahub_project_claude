// 검수 피드백 입력 카드 — textarea + 첨부 파일 칩 + 하단 액션(파일 첨부 / 기록).
//   다중 파일 첨부 + 드래그앤드롭 지원. 50MB / 10개 제한.
//   거부된 파일은 상위 onError 콜백으로 알림.

"use client";

import { useRef, useState } from "react";
import { CloudUpload, Paperclip, X } from "lucide-react";
import {
  formatFileSize,
  getFileIcon,
  MAX_FILES,
  validateFiles,
} from "./feedback-utils";

interface Props {
  onSubmit: (text: string, files: File[]) => void;
  /** 거부된 파일 알림 — 토스트 등으로 노출. */
  onError?: (msg: string) => void;
}

export function FeedbackInput({ onSubmit, onError }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = text.trim().length > 0 || files.length > 0;

  const addFiles = (incoming: File[]) => {
    const { accepted, rejected } = validateFiles(incoming, files.length);
    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
    }
    if (rejected.length > 0 && onError) {
      onError(rejected.map((r) => `${r.file.name}: ${r.reason}`).join("\n"));
    }
  };

  const onFilePick: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = Array.from(e.target.files ?? []);
    if (list.length) addFiles(list);
    e.target.value = "";
  };

  const onDragEnter: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragging(true);
  };
  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  };
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    // 자식 요소 진입 시 leave 가 잘못 트리거되는 경우가 있으므로 relatedTarget 검사.
    if ((e.currentTarget as Node).contains(e.relatedTarget as Node)) return;
    setDragging(false);
  };
  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setDragging(false);
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length) addFiles(list);
  };

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(text.trim(), files);
    setText("");
    setFiles([]);
  };

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="검수 결과와 피드백을 입력하세요"
        className="block w-full resize-y border-0 bg-transparent px-1 py-1 text-[12px] text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
        style={{ minHeight: 50 }}
      />

      {files.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {files.map((f, i) => {
            const { Icon, className } = getFileIcon(f.name);
            return (
              <li
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 py-1 pl-2 pr-1 text-[11px] dark:border-gray-700 dark:bg-gray-800/40"
              >
                <Icon size={12} aria-hidden="true" className={`shrink-0 ${className}`} />
                <span className="text-gray-800 dark:text-gray-200">{f.name}</span>
                <span className="text-gray-400 dark:text-gray-500">·</span>
                <span className="text-gray-400 dark:text-gray-500">
                  {formatFileSize(f.size)}
                </span>
                <button
                  type="button"
                  aria-label="파일 제거"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="ml-0.5 grid h-4 w-4 place-items-center rounded text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                >
                  <X size={10} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <Paperclip size={13} aria-hidden="true" />
          파일 첨부
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onFilePick}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="rounded-md bg-blue-50 px-4 py-1.5 text-[12px] font-medium text-blue-700 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300"
        >
          기록
        </button>
      </div>

      {dragging && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] border-dashed border-blue-500 bg-blue-50/95 px-4 text-center dark:border-blue-400 dark:bg-blue-950/80"
        >
          <CloudUpload size={22} aria-hidden="true" className="text-blue-700 dark:text-blue-300" />
          <div className="text-[12px] font-medium text-blue-700 dark:text-blue-300">
            여기에 파일을 놓아 첨부
          </div>
          <div className="text-[11px] text-blue-700/75 dark:text-blue-300/75">
            최대 {MAX_FILES}개 · 각 50MB 이내
          </div>
        </div>
      )}
    </div>
  );
}
