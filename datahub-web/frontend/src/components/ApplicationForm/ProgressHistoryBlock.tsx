// 진행 이력 카드 — 시스템 이벤트(StatusHistoryItem) + 사용자 메시지 통합 타임라인.
//   - 좌측 28px 아바타: 시스템=회색 + 아이콘, 신청자=파랑, 담당자=빨강, 어드민=보라
//   - 헤더 우측 '시스템 이벤트 포함' 토글 + 접기/펼치기
//   - 하단 composer: textarea + [첨부](최대 5개·각 50MB) + [수신자 지정] + [전송]
//   - 메시지는 데모용 로컬 state 보존 (실 백엔드 미연결)

"use client";

import { useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  AtSign,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  Paperclip,
  Send,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type {
  HistoryAction,
  StatusHistoryItem,
} from "@/lib/applicationFormConfig";

type SenderRole = "applicant" | "assignee" | "admin";

interface UserMessage {
  id: string;
  senderName: string;
  senderRole: SenderRole;
  recipient: string;
  /** 'M/d HH:mm' short form 또는 ISO. */
  timestamp: string;
  text: string;
  attachments: { name: string; size: number }[];
}

interface Props {
  history: StatusHistoryItem[];
  /** composer 노출 여부. 추적 모드 신청자/담당자 본인이면 true. */
  canPostMessage?: boolean;
  /** 현재 사용자 이름 (composer 발신자 표기용). */
  currentUserName?: string;
  /** 현재 사용자 역할 (메시지 아바타/배지용). */
  currentUserRole?: SenderRole;
  participants?: string[];
}

const SYSTEM_EVENT_ICON: Record<HistoryAction, LucideIcon> = {
  "임시 저장": Pencil,
  제출됨: Send,
  "검토 시작": UserCheck,
  "승인 완료": Check,
  "신청 취소": X,
};

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function initials(name: string): string {
  return name.trim().slice(0, 2) || "?";
}

function nowShort(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function ProgressHistoryBlock({
  history,
  canPostMessage = false,
  currentUserName = "나",
  currentUserRole = "applicant",
  participants = ["참여자 모두"],
}: Props) {
  const [open, setOpen] = useState(false);
  const [includeSystem, setIncludeSystem] = useState(true);
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [recipient, setRecipient] = useState<string>("참여자 모두");
  const [recipientOpen, setRecipientOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 시스템 이벤트 + 메시지 합쳐 시간순(과거→현재) 정렬.
  const items = useMemo(() => {
    const sys = includeSystem
      ? history.map((h, i) => ({
          kind: "system" as const,
          id: h.id ?? `sys-${i}`,
          timestamp: h.timestamp,
          item: h,
        }))
      : [];
    const msgs = messages.map((m) => ({
      kind: "message" as const,
      id: m.id,
      timestamp: m.timestamp,
      msg: m,
    }));
    return [...sys, ...msgs];
  }, [history, includeSystem, messages]);

  if (history.length === 0 && messages.length === 0) return null;

  const canSend = draftText.trim().length > 0 || draftFiles.length > 0;
  const onSend = () => {
    if (!canSend) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        senderName: currentUserName,
        senderRole: currentUserRole,
        recipient,
        timestamp: nowShort(),
        text: draftText.trim(),
        attachments: draftFiles.map((f) => ({ name: f.name, size: f.size })),
      },
    ]);
    setDraftText("");
    setDraftFiles([]);
    setRecipient("참여자 모두");
  };

  const onPickFiles: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = Array.from(e.target.files ?? []);
    const accepted = list
      .slice(0, 5 - draftFiles.length)
      .filter((f) => f.size <= 50 * 1024 * 1024);
    setDraftFiles((prev) => [...prev, ...accepted].slice(0, 5));
    e.target.value = "";
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
            진행 이력
          </h2>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
            {items.length}건
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={includeSystem}
              onChange={(e) => setIncludeSystem(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            시스템 이벤트 포함
          </label>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-xs text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {open ? (
              <ChevronUp size={12} aria-hidden="true" />
            ) : (
              <ChevronDown size={12} aria-hidden="true" />
            )}
            {open ? "접기" : "펼치기"}
          </button>
        </div>
      </header>

      {open && (
        <>
          <div className="relative flex flex-col gap-3.5">
            {items.length > 1 && (
              <div
                aria-hidden="true"
                className="absolute left-[13px] top-[14px] bottom-[14px] w-px bg-gray-200 dark:bg-gray-700"
              />
            )}
            {items.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-gray-400 dark:text-gray-500">
                아직 기록된 항목이 없습니다.
              </p>
            ) : (
              items.map((it) =>
                it.kind === "system" ? (
                  <SystemEventRow key={it.id} item={it.item} />
                ) : (
                  <UserMessageRow key={it.id} msg={it.msg} />
                ),
              )
            )}
          </div>

          {canPostMessage && (
            <div className="mt-4 border-t border-gray-200 pt-3.5 dark:border-gray-800">
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
                {recipient !== "참여자 모두" && (
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded bg-white px-2 py-0.5 text-[10px] text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
                    <ArrowRight size={9} aria-hidden="true" />
                    {recipient}
                    <button
                      type="button"
                      onClick={() => setRecipient("참여자 모두")}
                      className="ml-0.5 rounded p-0.5 text-gray-400 hover:text-gray-700"
                      aria-label="수신자 해제"
                    >
                      <X size={9} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {draftFiles.length > 0 && (
                  <ul className="mb-1.5 flex flex-wrap gap-1.5">
                    {draftFiles.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded bg-white px-2 py-1 text-[11px] ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
                      >
                        <Paperclip
                          size={10}
                          aria-hidden="true"
                          className="text-gray-400"
                        />
                        <span>{f.name}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-400">{fmtSize(f.size)}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setDraftFiles(draftFiles.filter((_, j) => j !== i))
                          }
                          className="ml-0.5 rounded p-0.5 text-gray-400 hover:text-gray-700"
                          aria-label="파일 제거"
                        >
                          <X size={9} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <textarea
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="메시지를 입력하세요. 참여자 모두가 볼 수 있습니다."
                  className="block min-h-[46px] w-full resize-y border-0 bg-transparent text-[12px] text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onPickFiles}
                />
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                      <Paperclip size={12} aria-hidden="true" />
                      첨부
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setRecipientOpen((v) => !v)}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      >
                        <AtSign size={12} aria-hidden="true" />
                        수신자 지정
                      </button>
                      {recipientOpen && (
                        <ul className="absolute left-0 top-full z-10 mt-1 min-w-[160px] overflow-hidden rounded-md border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-900">
                          {participants.map((p) => (
                            <li key={p}>
                              <button
                                type="button"
                                onClick={() => {
                                  setRecipient(p);
                                  setRecipientOpen(false);
                                }}
                                className="block w-full px-3 py-1.5 text-left text-[11px] text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                {p}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onSend}
                    disabled={!canSend}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-3 py-1.5 text-[12px] font-medium text-blue-700 transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    <Send size={12} aria-hidden="true" />
                    전송
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function SystemEventRow({ item }: { item: StatusHistoryItem }) {
  const Icon = SYSTEM_EVENT_ICON[item.action] ?? Pencil;
  return (
    <div className="relative z-[1] flex gap-3">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 ring-2 ring-white dark:bg-gray-800 dark:ring-gray-900">
        <Icon
          size={12}
          aria-hidden="true"
          className="text-gray-500 dark:text-gray-400"
        />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
            {item.action}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-px text-[9px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            시스템
          </span>
          <span className="text-[10px] text-gray-400">·</span>
          <span className="text-[10px] text-gray-400">{item.timestamp}</span>
          <span className="text-[10px] text-gray-400">·</span>
          <span className="text-[10px] text-gray-400">
            {item.actorRole} · {item.actor}
          </span>
        </div>
        {item.comment && (
          <div className="rounded-md bg-gray-50 px-3 py-2 text-[11px] text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
            {item.comment}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessageRow({ msg }: { msg: UserMessage }) {
  const tone =
    msg.senderRole === "applicant"
      ? {
          avatar: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
          badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
          label: "신청자",
        }
      : msg.senderRole === "admin"
      ? {
          avatar:
            "bg-purple-50 text-purple-800 ring-1 ring-purple-600 dark:bg-purple-900/40 dark:text-purple-200 dark:ring-purple-400",
          badge:
            "bg-purple-50 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200",
          label: "어드민",
        }
      : {
          avatar:
            "bg-orange-50 text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200",
          badge:
            "bg-orange-50 text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200",
          label: "담당자",
        };

  return (
    <div className="relative z-[1] flex gap-3">
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-medium ring-2 ring-white dark:ring-gray-900 ${tone.avatar}`}
      >
        {initials(msg.senderName)}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
            {msg.senderName}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-px text-[9px] font-medium ${tone.badge}`}
          >
            {msg.senderRole === "admin" && (
              <ShieldCheck size={9} aria-hidden="true" />
            )}
            {tone.label}
          </span>
          <ArrowRight size={10} aria-hidden="true" className="text-gray-400" />
          <span className="text-[11px] text-gray-600 dark:text-gray-300">
            {msg.recipient}
          </span>
          <span className="text-[10px] text-gray-400">·</span>
          <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-[12px] leading-relaxed text-gray-800 dark:bg-gray-800/40 dark:text-gray-100">
          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
          {msg.attachments.length > 0 && (
            <ul className={`flex flex-wrap gap-1.5 ${msg.text ? "mt-2" : ""}`}>
              {msg.attachments.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-900"
                >
                  <Paperclip
                    size={11}
                    aria-hidden="true"
                    className="text-gray-400"
                  />
                  <span>{a.name}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-400">{fmtSize(a.size)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
