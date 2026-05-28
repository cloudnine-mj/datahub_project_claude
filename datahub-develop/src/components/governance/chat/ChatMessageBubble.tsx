// 카톡 스타일 채팅 말풍선 — 보는 사람(currentUserEmail) 기준 좌우 분기.
//   본인 → 우측, 파랑 말풍선, 아바타 없음, 우상단 꼬리(border-radius 12px 4px 12px 12px)
//   상대 → 좌측, 회색 말풍선, 아바타 + 이름 표시, 좌상단 꼬리(border-radius 4px 12px 12px 12px)
//
// 첨부(ChatAttachment): 이미지는 썸네일, 그 외 파일은 확장자 색상 카드 + 다운로드.
//   본인/상대 모두 동일 카드 구조, 정렬(우/좌) 만 다름. 텍스트가 있으면 텍스트 + 첨부 함께.
//
// 시스템 이벤트(제출됨/검토 시작 등) 는 본 컴포넌트에서 다루지 않음 — 진행 이력 UI 와 분리.

"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import type { FormMessageItem } from "@/lib/governance/forms/types";
import {
  chatExtColor,
  chatExtLabel,
  formatChatBytes,
  type ChatAttachment,
} from "@/lib/governance/chat-upload";

interface Props {
  message: FormMessageItem;
  currentUserEmail: string;
  /** 담당자 표시용 팀명 — assignee 메시지의 이름 옆에 회색 보조 텍스트로 노출. */
  assigneeTeam?: string;
  /** 본인 말풍선 색 클래스 override — 미지정 시 파랑 톤. brand 톤은 ChatPanel 에서 전달. */
  mineBubbleClass?: string;
  /** 이 메시지에 딸린 첨부 (Phase 1 mock). */
  attachments?: ChatAttachment[];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h < 12 ? "오전" : "오후";
  const hh = ((h + 11) % 12) + 1;
  return `${ampm} ${hh}:${m}`;
}

/** 이름 첫 글자(또는 영문 머리글자) — 아바타 표시용. */
function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 1);
}

/** 첨부 목록 — 이미지 썸네일(클릭=확대 라이트박스) / 파일 카드. 부모 정렬을 따른다. */
function AttachmentList({ attachments }: { attachments: ChatAttachment[] }) {
  const [zoom, setZoom] = useState<ChatAttachment | null>(null);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zoom]);

  return (
    <div className="flex flex-col gap-1.5">
      {attachments.map((a) =>
        a.kind === "image" ? (
          <div key={a.id} className="relative w-fit">
            <button
              type="button"
              onClick={() => setZoom(a)}
              aria-label={`${a.name} 확대`}
              className="block overflow-hidden rounded-[10px] border border-gray-200 transition hover:brightness-95 dark:border-gray-700"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                className="block max-h-[180px] max-w-[200px] object-cover"
              />
            </button>
            {/* 다운로드 버튼 — 썸네일 우측 하단 오버레이. */}
            <a
              href={a.url}
              download={a.name}
              aria-label={`${a.name} 다운로드`}
              className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
            >
              <Download size={13} aria-hidden="true" />
            </a>
          </div>
        ) : (
          <a
            key={a.id}
            href={a.url}
            download={a.name}
            className="flex w-[240px] max-w-full items-center gap-2.5 rounded-[10px] border border-gray-200 bg-white px-2.5 py-2 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/60"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[9px] font-medium text-white"
              style={{ background: chatExtColor(a.name) }}
              aria-hidden="true"
            >
              {chatExtLabel(a.name)}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[12px] font-medium text-gray-900 dark:text-gray-100"
                title={a.name}
              >
                {a.name}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                {formatChatBytes(a.size)}
              </div>
            </div>
            <Download size={14} className="shrink-0 text-gray-400" aria-hidden="true" />
          </a>
        ),
      )}

      {/* 확대 라이트박스 — 오버레이/Esc 클릭으로 닫기, 이미지 클릭은 유지. */}
      {zoom && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${zoom.name} 확대 보기`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.url}
            alt={zoom.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
          <a
            href={zoom.url}
            download={zoom.name}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${zoom.name} 다운로드`}
            className="absolute right-16 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <Download size={16} aria-hidden="true" />
          </a>
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="닫기"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatMessageBubble({
  message,
  currentUserEmail,
  assigneeTeam,
  mineBubbleClass,
  attachments = [],
}: Props) {
  const isMine =
    !!currentUserEmail &&
    message.senderEmail.toLowerCase() === currentUserEmail.toLowerCase();
  const time = fmtTime(message.createdAt);
  const hasText = !!message.body && message.body.trim().length > 0;
  const hasAttachments = attachments.length > 0;
  const mineCls =
    mineBubbleClass ?? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";

  if (isMine) {
    return (
      <div className="flex justify-end gap-2">
        <div className="flex max-w-[80%] flex-col items-end gap-1.5">
          {hasText && (
            <div className={`rounded-[12px_4px_12px_12px] px-3 py-2.5 text-[12px] leading-relaxed ${mineCls}`}>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
            </div>
          )}
          {hasAttachments && <AttachmentList attachments={attachments} />}
          {time && <span className="text-[10px] text-gray-400">{time}</span>}
        </div>
      </div>
    );
  }

  // 담당자(상대) 메시지 — 좌측, 회색, 아바타 + 이름.
  return (
    <div className="flex gap-2">
      <div
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
        style={{ background: "#FAECE7", color: "#993C1D" }}
      >
        {initial(message.senderName)}
      </div>
      <div className="flex max-w-[80%] flex-col items-start gap-1.5">
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {message.senderName}
          {assigneeTeam && (
            <span className="text-gray-400 dark:text-gray-500"> ({assigneeTeam})</span>
          )}
        </div>
        {hasText && (
          <div className="rounded-[4px_12px_12px_12px] bg-gray-100 px-3 py-2.5 text-[12px] leading-relaxed text-gray-800 dark:bg-gray-800 dark:text-gray-100">
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </div>
        )}
        {hasAttachments && <AttachmentList attachments={attachments} />}
        {time && <span className="text-[10px] text-gray-400">{time}</span>}
      </div>
    </div>
  );
}
