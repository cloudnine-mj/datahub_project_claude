// 피드백 작성 모달 — 진행 단계 모든 진입점 공유.
//   1) 피드백 이력 카드 [+ 피드백 작성] (대상 '일반' 기본)
//   2) 최신 데이터 검토 [피드백 작성] (중간/수정, 대상 최신 자동)
//   3) 최신 데이터 검토 [문제 있음 → 피드백 작성] (최종, 대상 최종 최신 자동)
//
//   대상은 '일반' + 업로드된 각 납품 버전 중 택1. 텍스트/첨부 중 하나는 필수.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, MessageSquarePlus, Paperclip, Plus, Send, X } from "lucide-react";
import {
  deliveryShortLabel,
  formatBytes,
  type DeliveryRound,
  type FeedbackAttachmentMeta,
  type ReceivedDataItem,
} from "@/lib/governance/progress-storage";

/** 대상 선택값 — 'general' 또는 특정 (납품, 버전). */
export interface FeedbackTarget {
  deliveryRound: DeliveryRound | null;
  version: number | null;
}

interface TargetOption {
  key: string;
  label: string;
  target: FeedbackTarget;
}

interface Props {
  received: ReceivedDataItem[];
  /** 진입 시 미리 선택할 대상. 없으면 '일반'. */
  initialTarget?: FeedbackTarget;
  onClose: () => void;
  onSubmit: (payload: {
    targetDeliveryRound: DeliveryRound | null;
    targetVersion: number | null;
    content: string;
    attachments: FeedbackAttachmentMeta[];
  }) => void;
}

const GENERAL_KEY = "general";

function targetKey(t: FeedbackTarget): string {
  if (t.deliveryRound === null || t.version === null) return GENERAL_KEY;
  return `${t.deliveryRound}-${t.version}`;
}

export function FeedbackComposeModal({
  received,
  initialTarget,
  onClose,
  onSubmit,
}: Props) {
  // 대상 옵션 — '일반' + 업로드된 (납품, 버전) 중복 제거.
  const options = useMemo<TargetOption[]>(() => {
    const opts: TargetOption[] = [
      {
        key: GENERAL_KEY,
        label: "일반 (특정 버전 없음)",
        target: { deliveryRound: null, version: null },
      },
    ];
    const seen: Record<string, true> = {};
    received.forEach((it) => {
      const k = `${it.deliveryRound}-${it.version}`;
      if (seen[k]) return;
      seen[k] = true;
      opts.push({
        key: k,
        label: `${deliveryShortLabel(it.deliveryRound)} v${it.version}`,
        target: { deliveryRound: it.deliveryRound, version: it.version },
      });
    });
    return opts;
  }, [received]);

  const [selectedKey, setSelectedKey] = useState<string>(
    initialTarget ? targetKey(initialTarget) : GENERAL_KEY,
  );
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

  const canSend = content.trim().length > 0 || files.length > 0;

  function submit(): void {
    if (!canSend) return;
    const opt = options.find((o) => o.key === selectedKey) ?? options[0];
    onSubmit({
      targetDeliveryRound: opt.target.deliveryRound,
      targetVersion: opt.target.version,
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
        className="w-full max-w-[520px] rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquarePlus size={15} aria-hidden="true" className="text-[#D4533E]" />
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
          데이터에 대한 피드백, 개선 제안, 추가 요청 사항 등을 자유롭게 작성합니다.
        </p>

        {/* 대상 선택 (필수) */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] font-medium text-gray-700 dark:text-gray-200">
            대상 <span style={{ color: "#D4533E" }}>*</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const active = o.key === selectedKey;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setSelectedKey(o.key)}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] transition"
                  style={
                    active
                      ? { background: "#FCF3F0", border: "1px solid #D4533E", color: "#D4533E" }
                      : {
                          background: "#fff",
                          border: "0.5px solid var(--color-border-secondary,#d1d5db)",
                          color: "var(--color-text-tertiary,#9ca3af)",
                        }
                  }
                >
                  {active && <Check size={11} aria-hidden="true" />}
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] text-[var(--color-text-tertiary,#9ca3af)]">
            데이터가 없거나 일반 의견이면 &lsquo;일반&rsquo;을 선택하세요.
          </p>
        </div>

        {/* 피드백 내용 */}
        <label className="mb-1 block text-[10px] text-gray-500 dark:text-gray-400">
          피드백 내용
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="텍스트를 직접 작성하거나, 아래에서 문서를 첨부하거나, 둘 다 가능합니다."
          className="mb-3 w-full resize-none overflow-y-auto rounded-md border border-gray-200 bg-white px-3 py-2 text-[11px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          style={{ minHeight: "90px" }}
        />

        {/* 첨부 */}
        <div className="mb-1.5 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <Paperclip size={11} aria-hidden="true" />
          첨부 파일
          <span className="text-[9px] text-[var(--color-text-tertiary,#9ca3af)]">
            (엑셀·워드·PDF·이미지 등)
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
