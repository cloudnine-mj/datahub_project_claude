// 담당자와 소통 — 신청서 작성 화면 우측 채팅 패널.
//
// 레이아웃: 고정 높이 560px, flex column.
//   ┌─ 헤더(고정): "담당자와 소통" + 상태 배지
//   ├─ 메시지 영역(flex 1, overflow-y auto): 카톡 좌우 말풍선
//   └─ 입력창(고정): 캡슐형 input + 원형 send 버튼
//
// 데이터:
//   formId 가 없으면 send 시점에 ensureFormId 콜백으로 draft 자동 생성.
//   GET /api/governance/forms/{formId}/messages 로 메시지 로드.
//   POST 로 메시지 전송. 시스템 이벤트는 본 채팅에 표시하지 않음.
//
// 변형:
//   - welcome / suggestedQuestions: 빈 상태 대신 환영 메시지 + 추천 질문 칩 노출 (용역 제작 전용).
//   - headerVariant: "writing"(amber) | "online"(green) — 상태 배지 톤.
//   - accent: "blue" | "brand" — 본인 말풍선 / 전송 버튼 / 추천 칩 색.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/governance/api-client-full";
import type { FormMessageItem } from "@/lib/governance/forms/types";
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
  /** formId 가 없을 때 호출 — draft 자동 생성 후 새 formId 반환.
   *  반환값 null 이면 생성 실패. ApplicationFormContainer 가 persist(true) 로 구현. */
  ensureFormId?: () => Promise<string | null>;
  /** 첫 진입 시 빈 영역 채우는 담당자 환영 메시지 — 없으면 기본 빈 안내 표시. */
  welcome?: WelcomeMessage;
  /** 환영 메시지 아래 추천 질문 칩. 클릭하면 즉시 사용자 메시지로 전송. */
  suggestedQuestions?: string[];
  /** 본인 말풍선 / 추천 칩 / 전송 버튼의 강조 색. brand 는 #D4533E, blue 는 #2563EB 톤. */
  accent?: "blue" | "brand";
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
}: Props) {
  const [messages, setMessages] = useState<FormMessageItem[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
    // 다른 창에서 담당자가 답장하면 윈도우 focus 복귀 시 자동 갱신.
    const onFocus = () => {
      void fetchMessages();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchMessages]);

  // 새 메시지 추가/도착 시 최신으로 자동 스크롤.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const canSend = text.trim().length > 0 && !sending;

  async function sendText(body: string) {
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      // formId 없으면 ensureFormId 로 draft 자동 생성 → 새 id 로 메시지 전송.
      let targetId = formId;
      if (!targetId) {
        if (!ensureFormId) {
          throw new Error("신청서 저장 후 다시 시도해 주세요.");
        }
        targetId = await ensureFormId();
        if (!targetId) {
          throw new Error("신청서 저장에 실패했습니다.");
        }
      }
      const created = await api.createFormMessage(targetId, body);
      setMessages((prev) => [...prev, created]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function send() {
    if (!canSend) return;
    const body = text.trim();
    await sendText(body);
    setText("");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  // 추천 질문 칩 노출 조건: 추천 목록 있고 + 사용자가 아직 메시지 안 보냄.
  // welcome 유무와 무관.
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
  const accentSendIconCls = accent === "brand" ? "text-white" : "text-blue-600 dark:text-blue-300";
  const accentIconHeader = accent === "brand" ? "text-[#D4533E]" : "text-blue-500";

  return (
    <aside
      // 높이 산식 — 상단 sticky 네비게이션 바 h-16(64px) + sticky top 여백 16px +
      // 하단 여백 24px = 104px 를 뷰포트에서 뺀 값. 큰 화면에서는 max-h 560px 가 상한.
      className="flex h-[calc(100vh-104px)] max-h-[560px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      aria-label="담당자와 소통"
    >
      {/* 헤더 — 항상 보이도록 shrink 금지. */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className={accentIconHeader} aria-hidden="true" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            담당자와 소통
          </span>
        </div>
        {headerVariant === "online" ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "#0F6E56" }}
              aria-hidden="true"
            />
            담당자 온라인
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#FAEEDA", color: "#854F0B" }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: "#854F0B" }}
              aria-hidden="true"
            />
            작성 중
          </span>
        )}
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
            onPick={(q) => void sendText(q)}
            accentBorder={
              accent === "brand"
                ? "border-[#D4533E] text-[#D4533E] hover:bg-[#FCEAE5]/40"
                : "border-blue-500 text-blue-700 hover:bg-blue-50"
            }
          />
        )}

        {messages.length === 0 && !welcome && !showSuggestions && (
          <div className="m-auto max-w-[220px] text-center text-[12px] leading-relaxed text-gray-400">
            아직 메시지가 없습니다. 작성 중 궁금한 점을 담당자에게 문의해 보세요.
          </div>
        )}

        {messages.map((m) => (
          <ChatMessageBubble
            key={m.id}
            message={m}
            currentUserEmail={currentUserEmail}
            assigneeTeam={assigneeTeam}
            mineBubbleClass={accentBubble}
          />
        ))}

        {error && (
          <div className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* 입력창 — 항상 보이도록 shrink 금지. */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2 rounded-full bg-gray-50 py-1.5 pl-3.5 pr-1.5 dark:bg-gray-800">
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
              💬 {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
