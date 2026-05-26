// 카톡 스타일 채팅 말풍선 — 보는 사람(currentUserEmail) 기준 좌우 분기.
//   본인 → 우측, 파랑 말풍선, 아바타 없음, 우상단 꼬리(border-radius 12px 4px 12px 12px)
//   상대 → 좌측, 회색 말풍선, 아바타 + 이름 표시, 좌상단 꼬리(border-radius 4px 12px 12px 12px)
//
// 시스템 이벤트(제출됨/검토 시작 등) 는 본 컴포넌트에서 다루지 않음 — 진행 이력 UI 와 분리.

"use client";

import type { FormMessageItem } from "@/lib/governance/forms/types";

interface Props {
  message: FormMessageItem;
  currentUserEmail: string;
  /** 담당자 표시용 팀명 — assignee 메시지의 이름 옆에 회색 보조 텍스트로 노출. */
  assigneeTeam?: string;
  /** 본인 말풍선 색 클래스 override — 미지정 시 파랑 톤. brand 톤은 ChatPanel 에서 전달. */
  mineBubbleClass?: string;
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

export function ChatMessageBubble({ message, currentUserEmail, assigneeTeam, mineBubbleClass }: Props) {
  const isMine =
    !!currentUserEmail &&
    message.senderEmail.toLowerCase() === currentUserEmail.toLowerCase();
  const time = fmtTime(message.createdAt);
  const mineCls =
    mineBubbleClass ?? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";

  if (isMine) {
    return (
      <div className="flex justify-end gap-2">
        <div className="flex max-w-[80%] flex-col items-end">
          <div className={`rounded-[12px_4px_12px_12px] px-3 py-2.5 text-[12px] leading-relaxed ${mineCls}`}>
            <p className="whitespace-pre-wrap break-words">{message.body}</p>
          </div>
          {time && (
            <span className="mt-1 text-[10px] text-gray-400">{time}</span>
          )}
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
      <div className="max-w-[80%]">
        <div className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">
          {message.senderName}
          {assigneeTeam && (
            <span className="text-gray-400 dark:text-gray-500"> ({assigneeTeam})</span>
          )}
        </div>
        <div className="rounded-[4px_12px_12px_12px] bg-gray-100 px-3 py-2.5 text-[12px] leading-relaxed text-gray-800 dark:bg-gray-800 dark:text-gray-100">
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        </div>
        {time && <span className="mt-1 block text-[10px] text-gray-400">{time}</span>}
      </div>
    </div>
  );
}
