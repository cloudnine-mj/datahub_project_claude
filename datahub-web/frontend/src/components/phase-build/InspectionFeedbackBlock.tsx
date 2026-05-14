// 2단계 / 블록 3 — 검수 피드백 기록 + 코멘트 입력.
//   각 피드백: 회차 칩(coral) + 작성자 + 본문 (인라인 해결 상태 표시 가능).
//   canComment=false 면 입력창 미노출 (담당자 읽기 전용).

"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { PhaseBlock } from "@/components/PhaseBlock";

export interface InspectionFeedback {
  id: string;
  roundNumber: number;
  author: string;
  createdAt: string;
  content: string;
  resolution?: { status: "resolved" | "pending"; note: string };
}

interface Props {
  feedbacks: InspectionFeedback[];
  canComment?: boolean;
}

export function InspectionFeedbackBlock({ feedbacks, canComment = true }: Props) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    console.log("[stub] submit feedback:", draft);
    setDraft("");
  };

  return (
    <PhaseBlock icon={MessageCircle} title="검수 피드백 기록">
      {feedbacks.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          아직 피드백이 없습니다. 첫 검수 의견을 남겨주세요
        </p>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((f) => (
            <FeedbackItem key={f.id} feedback={f} />
          ))}
        </div>
      )}

      {canComment && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="검수 코멘트 또는 피드백을 남기세요"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            전송
          </button>
        </div>
      )}
    </PhaseBlock>
  );
}

function FeedbackItem({ feedback }: { feedback: InspectionFeedback }) {
  const resolutionColor =
    feedback.resolution?.status === "resolved"
      ? "text-green-700 dark:text-green-300"
      : "text-amber-700 dark:text-amber-300";

  return (
    <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span className="inline-flex items-center rounded-full bg-[#FAECE7] px-2 py-0.5 font-medium text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200">
          {feedback.roundNumber}회차 · {feedback.createdAt}
        </span>
        <span className="text-gray-700 dark:text-gray-300">{feedback.author}</span>
      </div>
      <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
        {feedback.content}
        {feedback.resolution && (
          <span className={`ml-1 inline-block text-xs font-medium ${resolutionColor}`}>
            → {feedback.resolution.note}
          </span>
        )}
      </p>
    </div>
  );
}
