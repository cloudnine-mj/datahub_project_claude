// 피드백 작성 모달 — 진행 단계 [+ 피드백 작성] 진입.
//   입력: 납품 구분(필수) → 자동 회차 안내 / 데이터 수령일(필수) / 피드백 내용(필수) / 첨부(선택).
//   전송: 납품 구분 + 수령일 + 내용(텍스트) 충족 시 활성. 첨부만으로는 불가. 채팅 알림 없음.

"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, Check, Info, MessageSquarePlus, Paperclip, Plus, Send, X } from "lucide-react";
import {
  calculateRoundNumber,
  deliveryLabel,
  formatBytes,
  todayYmd,
  type DeliveryRound,
  type FeedbackAttachmentMeta,
  type FeedbackItem,
} from "@/lib/governance/feedback-storage";

interface Props {
  /** 자동 회차 계산용 — 기존 피드백 이력. */
  history: FeedbackItem[];
  onClose: () => void;
  onSubmit: (payload: {
    deliveryRound: DeliveryRound;
    receivedDate: string;
    content: string;
    attachments: FeedbackAttachmentMeta[];
  }) => void;
}

export function FeedbackComposeModal({ history, onClose, onSubmit }: Props) {
  const [round, setRound] = useState<DeliveryRound | null>(null);
  const [receivedDate, setReceivedDate] = useState<string>(todayYmd());
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<FeedbackAttachmentMeta[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ESC 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function onPickFiles(picked: FileList | null): void {
    if (!picked || picked.length === 0) return;
    const next: FeedbackAttachmentMeta[] = [];
    Array.from(picked).forEach((f) => {
      next.push({ name: f.name, size: f.size, type: f.type });
    });
    setFiles((prev) => [...prev, ...next]);
  }

  function removeFile(idx: number): void {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // 전송 활성: 납품 구분 + 수령일 + 내용(텍스트) 필수. 첨부는 선택.
  const canSend =
    round !== null && receivedDate.length > 0 && content.trim().length > 0;
  // 자동 회차 = 선택된 납품 기존 건수 + 1.
  const roundNumber = round ? calculateRoundNumber(history, round) : 0;

  function submit(): void {
    if (!round || !canSend) return;
    onSubmit({
      deliveryRound: round,
      receivedDate,
      content: content.trim(),
      attachments: files,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-compose-title"
    >
      <div
        className="w-full max-w-[480px] rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquarePlus size={17} aria-hidden="true" className="text-[#D4533E]" />
            <h3
              id="feedback-compose-title"
              className="text-[14px] font-medium text-gray-900 dark:text-gray-100"
            >
              새 피드백 작성
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <p className="mb-3 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          메일·SharePoint로 받은 데이터에 대한 피드백, 개선 제안을 자유롭게 작성합니다.
        </p>

        {/* 납품 구분 (필수) */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] font-medium text-gray-700 dark:text-gray-200">
            납품 구분 <span style={{ color: "#D4533E" }}>*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <RoundButton
              round="middle"
              active={round === "middle"}
              caption="첫 납품"
              onClick={() => setRound("middle")}
            />
            <RoundButton
              round="modified"
              active={round === "modified"}
              caption="중간 피드백 반영"
              onClick={() => setRound("modified")}
            />
            <RoundButton
              round="final"
              active={round === "final"}
              caption="최종 납품"
              onClick={() => setRound("final")}
            />
          </div>
          {/* 자동 회차 안내 — 납품 구분 선택 시 노출. */}
          {round && (
            <div
              className="mt-2 flex items-center gap-1.5"
              style={{
                background: "#FCF8EF",
                border: "0.5px solid #EFC4B9",
                borderRadius: 5,
                padding: "7px 11px",
              }}
            >
              <Info size={12} aria-hidden="true" className="shrink-0 text-[#D4533E]" />
              <span className="text-[10px] text-[#993C1D]">
                이번 피드백은{" "}
                <strong className="font-medium">
                  {deliveryLabel(round)} {roundNumber}차
                </strong>
                로 자동 기록됩니다
              </span>
            </div>
          )}
        </div>

        {/* 데이터 수령일 (필수) */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] font-medium text-gray-700 dark:text-gray-200">
            데이터 수령일 <span style={{ color: "#D4533E" }}>*</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar
                size={13}
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-3 text-[11px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                style={{ fontVariantNumeric: "tabular-nums" }}
              />
            </div>
            <span className="shrink-0 text-[9px] text-[var(--color-text-tertiary,#9ca3af)]">
              메일·SharePoint로 받은 날짜
            </span>
          </div>
        </div>

        {/* 피드백 내용 (필수) */}
        <label className="mb-1 block text-[11px] font-medium text-gray-700 dark:text-gray-200">
          피드백 내용 <span style={{ color: "#D4533E" }}>*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="피드백 내용을 입력하세요"
          className="mb-3 w-full resize-none overflow-y-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          style={{ minHeight: "90px" }}
        />

        {/* 첨부 (선택) */}
        <div className="mb-1.5 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <Paperclip size={11} aria-hidden="true" />
          첨부 파일
          <span className="text-[9px] text-[var(--color-text-tertiary,#9ca3af)]">(선택)</span>
          <span className="text-[9px] text-[var(--color-text-tertiary,#9ca3af)]">
            · 엑셀·워드·PDF·이미지 등
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

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className={
              canSend
                ? "inline-flex items-center gap-1.5 rounded-md bg-[#D4533E] px-3.5 py-1.5 text-[11px] font-medium text-white transition hover:brightness-110"
                : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-[var(--color-background-secondary,#f3f4f6)] px-3.5 py-1.5 text-[11px] font-medium text-[var(--color-text-tertiary,#9ca3af)]"
            }
          >
            <Send size={12} aria-hidden="true" /> 피드백 전송
          </button>
        </div>
      </div>
    </div>
  );
}

function RoundButton({
  round,
  active,
  caption,
  onClick,
}: {
  round: DeliveryRound;
  active: boolean;
  caption: string;
  onClick: () => void;
}) {
  const label = deliveryLabel(round);
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex flex-col items-center gap-0.5 rounded-md border border-[#D4533E] bg-[#FCF3F0] px-2 py-2 text-[#D4533E] transition"
          : "flex flex-col items-center gap-0.5 rounded-md border-[0.5px] border-[var(--color-border-secondary,#d1d5db)] bg-white px-2 py-2 text-gray-700 transition hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200"
      }
    >
      <span className="text-[11px] font-medium">{label.replace(" 납품", "")}</span>
      <span
        className="text-[9px]"
        style={{ color: active ? "#D4533E" : "var(--color-text-tertiary,#9ca3af)" }}
      >
        {caption}
      </span>
      {active && <Check size={11} aria-hidden="true" className="text-[#D4533E]" />}
    </button>
  );
}
