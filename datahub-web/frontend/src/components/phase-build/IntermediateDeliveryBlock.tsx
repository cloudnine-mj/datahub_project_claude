// 2단계 / 블록 2 — 중간 수령·검수·피드백.
//   서브 영역 2개: 중간 납품 데이터 업로드 / 검수 결과·피드백 기록.

"use client";

import { useState } from "react";
import { CloudUpload, Package } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";

export function IntermediateDeliveryBlock() {
  const [feedback, setFeedback] = useState("");

  const upload = () => {
    console.log("[stub] 중간 납품 데이터 업로드");
  };

  const record = () => {
    if (!feedback.trim()) return;
    console.log("[stub] 검수 결과·피드백 기록:", feedback);
    setFeedback("");
  };

  return (
    <PhaseBlock icon={Package} title="중간 수령 · 검수 · 피드백">
      <p className="-mt-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
        중간 납품받은 데이터를 Datahub에 적재해 관리하고, 검수 결과와 피드백을
        기록하세요.
      </p>

      {/* 서브 영역 1: 중간 납품 데이터 */}
      <div className="mb-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          중간 납품 데이터
        </p>
        <div className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2.5 dark:bg-gray-800/40">
          <CloudUpload
            size={18}
            aria-hidden="true"
            className="shrink-0 text-gray-500 dark:text-gray-400"
          />
          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">
            중간 납품 데이터를 Datahub에 적재하세요
          </span>
          <button
            type="button"
            onClick={upload}
            className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            업로드
          </button>
        </div>
      </div>

      {/* 서브 영역 2: 검수 결과 및 피드백 */}
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
        <p className="mb-2 text-xs font-medium text-gray-700 dark:text-gray-300">
          검수 결과 및 피드백
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                record();
              }
            }}
            placeholder="검수 결과와 피드백을 입력하세요"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={record}
            className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            기록
          </button>
        </div>
      </div>
    </PhaseBlock>
  );
}
