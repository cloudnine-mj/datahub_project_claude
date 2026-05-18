// 3단계 / 블록 1 — 중앙 저장소 적재 (업로드 안내 + 버튼).
//   데모: 실제 업로드는 없지만 네이티브 file picker 가 열리고 파일명·크기를
//   표시 → 사용자가 동작 확인 가능.

"use client";

import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function DataUploadBlock() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  const openPicker = () => inputRef.current?.click();

  return (
    <PhaseBlock icon={CloudUpload} title="중앙 저장소 적재">
      <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
        최종 데이터를 Datahub 중앙 저장소에 적재하세요.
      </p>
      <div className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2.5 dark:bg-gray-800/40">
        <CloudUpload
          size={18}
          aria-hidden="true"
          className="shrink-0 text-gray-500 dark:text-gray-400"
        />
        <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">
          {file ? `${file.name} (${formatSize(file.size)})` : "최종 데이터를 업로드하세요"}
        </span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={openPicker}
          className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {file ? "다시 선택" : "업로드"}
        </button>
      </div>
    </PhaseBlock>
  );
}
