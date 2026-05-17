// 중간 수령·검수·피드백 단계 body (current 상태) — 서브 영역 2개.
//   1) 중간 납품 데이터: 누적 목록 + '새 중간 납품 적재' 점선 버튼
//   2) 검수 결과 및 피드백: 누적 카드 + 입력란 + '기록' 버튼
//   가이드라인 안내대로 회차 카드 구조 / 진행률 바 등은 추가하지 않음.

"use client";

import { useState, type KeyboardEvent } from "react";
import { CloudUpload, File } from "lucide-react";
import type { DeliveryStep } from "./useBuildPhase";

interface Props {
  delivery: DeliveryStep;
  onAddUpload: () => void;
  onAddFeedback: (content: string) => void;
}

export function DeliveryStepBody({ delivery, onAddUpload, onAddFeedback }: Props) {
  const [draft, setDraft] = useState("");

  const onSubmitFeedback = () => {
    const t = draft.trim();
    if (!t) return;
    onAddFeedback(t);
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmitFeedback();
    }
  };

  return (
    <>
      <SubArea
        title="중간 납품 데이터"
        trailing={`적재 ${delivery.intermediateUploads.length}건`}
      >
        {delivery.intermediateUploads.length > 0 && (
          <div className="mb-2.5 flex flex-col gap-1.5">
            {delivery.intermediateUploads.map((u) => (
              <div
                key={u.id}
                className="flex items-center gap-2 rounded-md bg-gray-50 px-2.5 py-1.5 text-[11px] dark:bg-gray-800/40"
              >
                <File
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-gray-500 dark:text-gray-400"
                />
                <span className="flex-1 text-gray-800 dark:text-gray-200">{u.label}</span>
                <span className="text-gray-400 dark:text-gray-500">{u.uploadedAt}</span>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            console.log("[stub] 새 중간 납품 적재");
            onAddUpload();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-[11px] text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <CloudUpload size={13} aria-hidden="true" />
          새 중간 납품 적재
        </button>
      </SubArea>

      <SubArea
        title="검수 결과 및 피드백"
        trailing={`기록 ${delivery.feedbacks.length}건`}
      >
        {delivery.feedbacks.length > 0 && (
          <div className="mb-2.5 flex flex-col gap-2">
            {delivery.feedbacks.map((f) => (
              <div
                key={f.id}
                className="rounded-md bg-gray-50 px-2.5 py-2 text-[11px] dark:bg-gray-800/40"
              >
                <div className="mb-1 flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {f.author}
                  </span>
                  <span>·</span>
                  <span>{f.createdAt}</span>
                </div>
                <p className="leading-relaxed text-gray-600 dark:text-gray-300">
                  {f.content}
                </p>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="검수 결과와 피드백을 입력하세요"
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={onSubmitFeedback}
            className="shrink-0 rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            기록
          </button>
        </div>
      </SubArea>
    </>
  );
}

function SubArea({
  title,
  trailing,
  children,
}: {
  title: string;
  trailing: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{title}</span>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">{trailing}</span>
      </div>
      {children}
    </div>
  );
}
