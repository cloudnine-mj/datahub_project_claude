// 담당자와 소통 — 신청서 작성 화면 우측 채팅 패널.
//
// 레이아웃: flex column.
//   ┌─ 헤더(고정): "담당자와 소통"
//   ├─ 메시지 영역(flex 1, overflow-y auto): 카톡 좌우 말풍선 (텍스트 + 첨부)
//   └─ 입력창(고정): [전송 전 첨부 미리보기] + 캡슐형 input(클립·textarea·send)
//
// 데이터:
//   formId 가 없으면 send 시점에 ensureFormId 콜백으로 draft 자동 생성.
//   메시지 본문은 백엔드(POST messages, 빈 본문 허용) 저장.
//   첨부는 Phase 1 mock — messageId 기준 sessionStorage(dh:gov:chat-attachments:{formId}).
//   Phase 2 전환 시 lib/governance/chat-upload.ts 의 uploadChatAttachment 구현부만 교체.

"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { api } from "@/lib/governance/api-client-full";
import type { FormMessageItem } from "@/lib/governance/forms/types";
import {
  CHAT_ACCEPT,
  chatExtColor,
  chatExtLabel,
  uploadChatAttachment,
  validateChatFile,
  type ChatAttachment,
} from "@/lib/governance/chat-upload";
import { ChatMessageBubble } from "./ChatMessageBubble";

interface WelcomeMessage {
  senderName: string;
  senderTeam?: string;
  body: string;
}

interface Props {
  /** 신청서 ID — null 이면 send 시점에 ensureFormId 로 자동 draft 생성. */
  formId: string | null;
  /** 현재 로그인 사용자 이메일 — 본인 메시지 우측 배치 결정. */
  currentUserEmail: string;
  /** 담당자 정보 — 메시지 sender 옆에 (team) 회색 보조 텍스트로 표시. */
  assigneeTeam?: string;
  /** 상단 상태 배지 톤 — "writing"(amber, 기본) | "online"(green). */
  headerVariant?: "writing" | "online";
  /** formId 가 없을 때 호출 — draft 자동 생성 후 새 formId 반환. */
  ensureFormId?: () => Promise<string | null>;
  /** 첫 진입 시 빈 영역 채우는 담당자 환영 메시지 — 없으면 기본 빈 안내 표시. */
  welcome?: WelcomeMessage;
  /** 환영 메시지 아래 추천 질문 칩. 클릭하면 즉시 사용자 메시지로 전송. */
  suggestedQuestions?: string[];
  /** 본인 말풍선 / 추천 칩 / 전송 버튼의 강조 색. brand 는 #D4533E, blue 는 #2563EB 톤. */
  accent?: "blue" | "brand";
  /** true 면 부모 컨테이너 높이를 100% 채움 (h-full). */
  fillParent?: boolean;
  /** 현재 진행 단계 인덱스 — 메시지 사이 단계 변경 지점에 구분선. */
  currentStage?: number;
  /** 단계 인덱스를 라벨로 매핑 — 미지정 시 기본값 사용. */
  stageLabels?: readonly string[];
}

const DEFAULT_STAGE_LABELS = ["신청", "협의", "진행", "종료"] as const;

const STAGE_MAP_KEY = (formId: string) => `dh:gov:chat-stages:${formId}`;

function readStageMap(formId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STAGE_MAP_KEY(formId));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeStageMap(formId: string, next: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STAGE_MAP_KEY(formId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// ── 채팅 첨부 (Phase 1 mock) — messageId → ChatAttachment[] 맵을 sessionStorage 영속.
//    이미지 dataURL 은 새로고침에도 미리보기 유지. 용량(약 5MB) 초과 시 저장 실패해도
//    in-memory 로는 동작(graceful degrade — 새로고침 시에만 일부 유실 가능).
const ATTACH_MAP_KEY = (formId: string) => `dh:gov:chat-attachments:${formId}`;

function readMsgAttachments(formId: string): Record<string, ChatAttachment[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(ATTACH_MAP_KEY(formId));
    return raw ? (JSON.parse(raw) as Record<string, ChatAttachment[]>) : {};
  } catch {
    return {};
  }
}

function writeMsgAttachments(
  formId: string,
  next: Record<string, ChatAttachment[]>,
): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ATTACH_MAP_KEY(formId), JSON.stringify(next));
  } catch {
    /* 용량 초과 등 — 저장 실패해도 in-memory 상태는 유지(새로고침 시 일부 유실). */
  }
}

export function ChatPanel({
  formId,
  currentUserEmail,
  assigneeTeam,
  headerVariant = "writing",
  ensureFormId,
  welcome,
  suggestedQuestions,
  accent = "blue",
  fillParent = false,
  currentStage,
  stageLabels = DEFAULT_STAGE_LABELS,
}: Props) {
  const [messages, setMessages] = useState<FormMessageItem[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [stageMap, setStageMap] = useState<Record<string, number>>({});
  // 전송 전 첨부 미리보기 + 전송 완료된 메시지별 첨부 맵.
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [msgAttachments, setMsgAttachments] = useState<
    Record<string, ChatAttachment[]>
  >({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const showDividers = currentStage !== undefined;

  useEffect(() => {
    if (!formId) return;
    setStageMap(readStageMap(formId));
    setMsgAttachments(readMsgAttachments(formId));
  }, [formId]);

  const fetchMessages = useCallback(async () => {
    if (!formId) return;
    try {
      const list = await api.listFormMessages(formId);
      setMessages(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [formId]);

  useEffect(() => {
    void fetchMessages();
    const onFocus = () => {
      void fetchMessages();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchMessages]);

  // 새 메시지/첨부 추가·도착 시 최신으로 자동 스크롤.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length]);

  const canSend = (text.trim().length > 0 || pending.length > 0) && !sending;

  /** 텍스트(+첨부) 전송. 성공 시 true. */
  async function sendMessage(
    body: string,
    atts: ChatAttachment[],
  ): Promise<boolean> {
    if ((!body && atts.length === 0) || sending) return false;
    setSending(true);
    setError(null);
    try {
      let targetId = formId;
      if (!targetId) {
        if (!ensureFormId) throw new Error("신청서 저장 후 다시 시도해 주세요.");
        targetId = await ensureFormId();
        if (!targetId) throw new Error("신청서 저장에 실패했습니다.");
      }
      const created = await api.createFormMessage(targetId, body);
      setMessages((prev) => [...prev, created]);
      // 첨부 — 생성된 messageId 기준으로 영속.
      if (atts.length > 0) {
        const nextMap = { ...msgAttachments, [created.id]: atts };
        setMsgAttachments(nextMap);
        writeMsgAttachments(targetId, nextMap);
      }
      // 단계 구분선용 stageAtSent.
      if (currentStage !== undefined) {
        const next = { ...stageMap, [created.id]: currentStage };
        setStageMap(next);
        writeStageMap(targetId, next);
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSending(false);
    }
  }

  async function send() {
    if (!canSend) return;
    const ok = await sendMessage(text.trim(), pending);
    if (ok) {
      setText("");
      setPending([]);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  function onPickFile() {
    fileInputRef.current?.click();
  }

  // 파일 선택 → 검증 후 mock 업로드하여 전송 전 미리보기(pending) 에 추가.
  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    const list = Array.from(files);
    const accepted: ChatAttachment[] = [];
    // es5: 인덱스 for (순차 await). for...of 미사용.
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const err = validateChatFile(f);
      if (err) {
        setError(err);
        continue;
      }
      try {
        accepted.push(await uploadChatAttachment(f));
      } catch {
        setError(`"${f.name}" 처리에 실패했습니다.`);
      }
    }
    if (accepted.length > 0) setPending((prev) => [...prev, ...accepted]);
    e.target.value = "";
  }

  function removePending(id: string) {
    setPending((prev) => prev.filter((a) => a.id !== id));
  }

  const showSuggestions =
    !!suggestedQuestions &&
    suggestedQuestions.length > 0 &&
    messages.length === 0;

  const accentBubble =
    accent === "brand"
      ? "bg-[#FCEAE5] text-[#993C1D] dark:bg-[#5B2719]/60 dark:text-[#F4B59E]"
      : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";
  const accentSendBg =
    accent === "brand"
      ? "bg-[#D4533E] hover:brightness-110"
      : "bg-blue-50 hover:brightness-95 dark:bg-blue-900/40";
  const accentSendIconCls =
    accent === "brand" ? "text-white" : "text-blue-600 dark:text-blue-300";
  const accentIconHeader = accent === "brand" ? "text-[#D4533E]" : "text-blue-500";

  const heightCls = fillParent
    ? "h-full"
    : "h-[calc(100vh-104px)] max-h-[560px]";
  return (
    <aside
      className={`flex ${heightCls} flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900`}
      aria-label="담당자와 소통"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 px-4 py-3.5 dark:border-gray-800">
        <MessageCircle size={16} className={accentIconHeader} aria-hidden="true" />
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          담당자와 소통
        </span>
      </header>

      {/* 메시지 영역 — min-h-0 필수 (flex 자식 스크롤 정상 동작). */}
      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4"
      >
        {welcome && messages.length === 0 && <WelcomeBlock welcome={welcome} />}

        {showSuggestions && (
          <SuggestionChips
            questions={suggestedQuestions!}
            disabled={sending}
            onPick={(q) => void sendMessage(q, [])}
            accentBorder={
              accent === "brand"
                ? "border-[#D4533E] text-[#D4533E] hover:bg-[#FCEAE5]/40"
                : "border-blue-500 text-blue-700 hover:bg-blue-50"
            }
          />
        )}

        {messages.length === 0 && !welcome && !showSuggestions && (
          <div className="m-auto max-w-[220px] text-center text-[12px] leading-relaxed text-gray-400">
            아직 메시지가 없습니다.
          </div>
        )}

        {(() => {
          let lastStage = -1;
          return messages.map((m) => {
            const stage = stageMap[m.id] ?? 0;
            const showDivider = showDividers && stage !== lastStage;
            if (showDividers) lastStage = stage;
            return (
              <Fragment key={m.id}>
                {showDivider && (
                  <StageDivider
                    label={stageLabels[stage] ?? `단계 ${stage + 1}`}
                    isCurrent={stage === currentStage}
                  />
                )}
                <ChatMessageBubble
                  message={m}
                  currentUserEmail={currentUserEmail}
                  assigneeTeam={assigneeTeam}
                  mineBubbleClass={accentBubble}
                  attachments={msgAttachments[m.id]}
                />
              </Fragment>
            );
          });
        })()}

        {error && (
          <div className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* 입력창 — 항상 보이도록 shrink 금지. */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
        {/* 전송 전 첨부 미리보기 */}
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((a) => (
              <PendingChip key={a.id} att={a} onRemove={() => removePending(a.id)} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-full bg-gray-50 py-1.5 pl-2 pr-1.5 dark:bg-gray-800">
          <input
            ref={fileInputRef}
            type="file"
            accept={CHAT_ACCEPT}
            multiple
            className="hidden"
            onChange={onFileSelected}
          />
          <button
            type="button"
            onClick={onPickFile}
            disabled={sending}
            aria-label="파일 첨부"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:text-gray-600 disabled:opacity-40 dark:hover:text-gray-200"
          >
            <Paperclip size={15} aria-hidden="true" />
          </button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="메시지를 입력하세요..."
            disabled={sending}
            rows={1}
            className="flex-1 resize-none border-0 bg-transparent text-[12px] leading-snug text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-gray-100"
          />
          <button
            type="button"
            onClick={send}
            disabled={!canSend}
            aria-label="메시지 보내기"
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${accentSendBg}`}
          >
            <Send size={14} className={accentSendIconCls} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/** 전송 전 첨부 미리보기 칩 — 이미지 썸네일 / 파일 칩 + 개별 제거. */
function PendingChip({
  att,
  onRemove,
}: {
  att: ChatAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white py-1 pl-1 pr-1.5 dark:border-gray-700 dark:bg-gray-800">
      {att.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={att.url}
          alt={att.name}
          className="h-11 w-11 rounded object-cover"
        />
      ) : (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-md text-[9px] font-medium text-white"
          style={{ background: chatExtColor(att.name) }}
          aria-hidden="true"
        >
          {chatExtLabel(att.name)}
        </span>
      )}
      <span
        className="max-w-[120px] truncate text-[11px] text-gray-700 dark:text-gray-200"
        title={att.name}
      >
        {att.name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${att.name} 제거`}
        className="shrink-0 rounded-full p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

/** 첫 진입 시 담당자 환영 말풍선. */
function WelcomeBlock({ welcome }: { welcome: WelcomeMessage }) {
  const initial = welcome.senderName.trim().slice(0, 1) || "?";
  return (
    <div className="flex gap-2">
      <div
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
        style={{ background: "#FAECE7", color: "#993C1D" }}
      >
        {initial}
      </div>
      <div className="max-w-[85%]">
        <div className="mb-1 text-[11px] text-gray-500 dark:text-gray-400">
          {welcome.senderName}
          {welcome.senderTeam && (
            <span className="text-gray-400 dark:text-gray-500"> ({welcome.senderTeam})</span>
          )}
        </div>
        <div className="rounded-[4px_12px_12px_12px] bg-gray-100 px-3 py-2.5 text-[12px] leading-relaxed text-gray-800 dark:bg-gray-800 dark:text-gray-100">
          {welcome.body}
        </div>
      </div>
    </div>
  );
}

/** 단계 구분선 — 메시지 사이에서 단계가 바뀌는 지점에 노출. */
function StageDivider({ label, isCurrent }: { label: string; isCurrent: boolean }) {
  if (isCurrent) {
    return (
      <div className="my-1 flex items-center gap-2" aria-hidden="true">
        <div className="h-px flex-1" style={{ background: "#D4533E", opacity: 0.4 }} />
        <span
          className="rounded-full px-2 py-0.5 text-[9px] font-medium"
          style={{ background: "#FEF1ED", color: "#D4533E" }}
        >
          {label} 단계 · 현재
        </span>
        <div className="h-px flex-1" style={{ background: "#D4533E", opacity: 0.4 }} />
      </div>
    );
  }
  return (
    <div className="my-1 flex items-center gap-2" aria-hidden="true">
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
        {label} 단계
      </span>
      <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

/** 환영 메시지 아래 추천 질문 칩 — 클릭 시 사용자 메시지로 전송. */
function SuggestionChips({
  questions,
  disabled,
  onPick,
  accentBorder,
}: {
  questions: string[];
  disabled: boolean;
  onPick: (q: string) => void;
  accentBorder: string;
}) {
  return (
    <div className="flex gap-2">
      <div className="h-7 w-7 shrink-0" aria-hidden="true" />
      <div className="max-w-[85%]">
        <div className="mb-2 rounded-[4px_12px_12px_12px] bg-gray-100 px-3 py-2.5 text-[12px] leading-relaxed text-gray-700 dark:bg-gray-800 dark:text-gray-200">
          이런 점이 자주 궁금하세요:
        </div>
        <div className="flex flex-col gap-1.5">
          {questions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPick(q)}
              disabled={disabled}
              className={`rounded-full border bg-white px-3 py-2 text-left text-[11px] transition disabled:opacity-50 dark:bg-gray-900 ${accentBorder}`}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
