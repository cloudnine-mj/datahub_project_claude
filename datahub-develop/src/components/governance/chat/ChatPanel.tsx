// 담당자와 소통 — 신청서 작성 화면 우측 채팅 패널.
//
// 레이아웃: 고정 높이 560px, flex column.
//   ┌─ 헤더(고정): "담당자와 소통" + 상태 배지(작성 중)
//   ├─ 메시지 영역(flex 1, overflow-y auto): 카톡 좌우 말풍선
//   └─ 입력창(고정): 캡슐형 input + 원형 send 버튼
//
// 데이터:
//   formId 가 없으면 (임시저장 전) "임시저장 후 사용 가능" 안내.
//   formId 가 있으면 GET /api/governance/forms/{formId}/messages 로 메시지 로드.
//   POST 로 메시지 전송. 시스템 이벤트는 본 채팅에 표시하지 않음.
//
// 적용 범위: ApplicationFormContainer 의 draft 모드 (용역 제작 / 데이터 구매 / 데이터 구독).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { api } from "@/lib/governance/api-client-full";
import type { FormMessageItem } from "@/lib/governance/forms/types";
import { ChatMessageBubble } from "./ChatMessageBubble";

interface Props {
  /** 신청서 ID — null 이면 send 시점에 ensureFormId 로 자동 draft 생성. */
  formId: string | null;
  /** 현재 로그인 사용자 이메일 — 본인 메시지 우측 배치 결정. */
  currentUserEmail: string;
  /** 담당자 정보 — 헤더의 상대 표시는 메시지 자체의 sender 로 결정되므로 추가 표시는 안 함. */
  assigneeTeam?: string;
  /** "작성 중" / "제출됨" — 상단 상태 배지. Phase 1 은 작성 중만 사용. */
  status?: "writing" | "submitted";
  /** formId 가 없을 때 호출 — draft 자동 생성 후 새 formId 반환.
   *  반환값 null 이면 생성 실패. ApplicationFormContainer 가 persist(true) 로 구현. */
  ensureFormId?: () => Promise<string | null>;
}

export function ChatPanel({
  formId,
  currentUserEmail,
  assigneeTeam,
  status = "writing",
  ensureFormId,
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

  async function send() {
    if (!canSend) return;
    const body = text.trim();
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
      setText("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <aside
      className="flex h-[560px] flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      aria-label="담당자와 소통"
    >
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-blue-500" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
            담당자와 소통
          </span>
        </div>
        {status === "writing" && (
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

      {/* 메시지 영역 */}
      <div
        ref={listRef}
        className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="m-auto max-w-[220px] text-center text-[12px] leading-relaxed text-gray-400">
            아직 메시지가 없습니다. 작성 중 궁금한 점을 담당자에게 문의해 보세요.
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessageBubble
              key={m.id}
              message={m}
              currentUserEmail={currentUserEmail}
              assigneeTeam={assigneeTeam}
            />
          ))
        )}
        {error && (
          <div className="rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* 입력창 */}
      <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 transition hover:brightness-95 disabled:opacity-40 dark:bg-blue-900/40"
          >
            <Send size={14} className="text-blue-600 dark:text-blue-300" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
