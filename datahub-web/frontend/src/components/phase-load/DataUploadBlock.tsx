// 3단계 / 블록 1 — 중앙 저장소 적재 (업로드 안내 + 버튼).

"use client";

import { CloudUpload } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";

export function DataUploadBlock() {
  const upload = () => {
    console.log("[stub] 최종 데이터 업로드");
  };

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
        <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
          최종 데이터를 업로드하세요
        </span>
        <button
          type="button"
          onClick={upload}
          className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          업로드
        </button>
      </div>
    </PhaseBlock>
  );
}
