/**
 * 담당자 논의·확정 단계의 코멘트 영역.
 *
 *  - 신청 유형(planning type) 에 따라 자동 지정된 담당자가 회신 대상.
 *  - 이 단계는 신청서 제출 전이라 백엔드 requestId 가 없음 → 로컬 state 만 사용.
 *  - 데모 목적으로 담당자 샘플 메시지 1건을 미리 표시.
 *  - canConfirm: 담당자(assignee) 코멘트가 1건 이상 있을 때만 true → 부모가
 *    확정 체크박스 활성화 여부를 결정.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { File as FileIcon, MessageCircle, Paperclip, Send, X } from "lucide-react";
import type { PlanningType } from "@/lib/governance/forms/planning-config";

interface Assignee {
  name: string;
  team: string;
}

const ASSIGNEE_BY_TYPE: Record<PlanningType, Assignee> = {
  purchase: { name: "박용민", team: "AI Biz. Development Team" },
  subscribe: { name: "박용민", team: "AI Biz. Development Team" },
  service: { name: "김은솔", team: "Data Governance Team" },
};

interface ThreadAttachment {
  name: string;
  size: number;
}

interface ThreadMessage {
  id: string;
  /** 'applicant' (신청자, 본인) | 'assignee' (담당자) */
  role: "applicant" | "assignee";
  authorName: string;
  /** 'M/d HH:mm' 짧은 표기 */
  timestamp: string;
  text: string;
  attachments: ThreadAttachment[];
}

interface Props {
  planningType: PlanningType;
  /** 현재 사용자 이름 (본인 메시지 발신자 표기용). 기본 'PM 김철수 (나)'. */
  currentUserName?: string;
  /** 담당자 코멘트 존재 여부가 바뀔 때 부모에 통보. 부모는 이 값으로 확정 게이트. */
  onAssigneeReplyChange?: (has: boolean) => void;
}

function initials(name: string): string {
  return (name ?? "").trim().slice(0, 1) || "?";
}

function nowShort(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mi}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const MAX_FILE_BYTES = 50 * 1024 * 1024;

export function DiscussionThread({
  planningType,
  currentUserName = "PM 김철수 (나)",
  onAssigneeReplyChange,
}: Props) {
  const assignee = ASSIGNEE_BY_TYPE[planningType];

  // 데모용 사전 메시지 — 신청자 1건 + 담당자 1건. 사용자는 그 위에 본인 코멘트를 추가.
  const [messages, setMessages] = useState<ThreadMessage[]>(() => [
    {
      id: "demo-applicant",
      role: "applicant",
      authorName: currentUserName,
      timestamp: nowShort(),
      text: "1년 단위 구독으로 생각하고 있고, 분기마다 데이터 갱신이 필요합니다. 견적 부탁드립니다.",
      attachments: [{ name: "데이터요구사항.pdf", size: 142_000 }],
    },
    {
      id: "demo-assignee",
      role: "assignee",
      authorName: assignee.name,
      timestamp: nowShort(),
      text: "확인했습니다. 1년 구독 기준 견적서 첨부드립니다. 분기 갱신 일정도 함께 정리했으니 검토 후 확정 부탁드립니다.",
      attachments: [{ name: "구독견적_2026.xlsx", size: 88_000 }],
    },
  ]);

  const [draftText, setDraftText] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasAssigneeReply = useMemo(
    () => messages.some((m) => m.role === "assignee"),
    [messages],
  );

  useEffect(() => {
    onAssigneeReplyChange?.(hasAssigneeReply);
  }, [hasAssigneeReply, onAssigneeReplyChange]);

  const canSend = draftText.trim().length > 0 || draftFiles.length > 0;

  const onPickFiles: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const list = Array.from(e.target.files ?? []);
    const oversize = list.find((f) => f.size > MAX_FILE_BYTES);
    if (oversize) {
      setToast(`${oversize.name}: 50MB 초과 — 첨부할 수 없습니다.`);
      setTimeout(() => setToast(null), 3000);
    }
    const accepted = list.filter((f) => f.size <= MAX_FILE_BYTES);
    setDraftFiles((prev) => {
      const dedup = new Map<string, File>();
      [...prev, ...accepted].forEach((f) => dedup.set(`${f.name}-${f.size}`, f));
      return Array.from(dedup.values()).slice(0, 5);
    });
    e.target.value = "";
  };

  const onSend = () => {
    if (!canSend) return;
    const text = draftText.trim();
    const attachments = draftFiles.map((f) => ({ name: f.name, size: f.size }));
    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        role: "applicant",
        authorName: currentUserName,
        timestamp: nowShort(),
        text,
        attachments,
      },
    ]);
    setDraftText("");
    setDraftFiles([]);
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-2">
        <MessageCircle size={14} className="text-blue-600" aria-hidden="true" />
        <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
          담당자와의 논의
        </h2>
      </header>

      <div className="space-y-3.5">
        {messages.map((m) => (
          <MessageRow key={m.id} msg={m} />
        ))}
      </div>

      {/* composer */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 focus-within:border-blue-300 dark:border-gray-700 dark:bg-gray-800/40">
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder="담당자에게 보낼 메시지를 입력하세요"
          className="block min-h-[46px] w-full resize-y border-0 bg-transparent text-[12px] text-gray-800 placeholder:text-gray-400 focus:outline-none dark:text-gray-100"
        />
        {draftFiles.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {draftFiles.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="inline-flex items-center gap-1.5 rounded bg-white px-2 py-1 text-[11px] ring-1 ring-inset ring-gray-200 dark:bg-gray-900 dark:ring-gray-700"
              >
                <Paperclip size={10} className="text-gray-400" aria-hidden="true" />
                <span>{f.name}</span>
                <span className="text-gray-400">{fmtSize(f.size)}</span>
                <button
                  type="button"
                  onClick={() => setDraftFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="파일 제거"
                  className="ml-0.5 rounded p-0.5 text-gray-400 hover:text-gray-700"
                >
                  <X size={9} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onPickFiles}
        />
        <div className="mt-2.5 flex items-center justify-between border-t border-gray-200 pt-2.5 dark:border-gray-700">
          <div className="flex items-center gap-2.5 text-[11px] text-gray-500">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Paperclip size={11} aria-hidden="true" /> 첨부
            </button>
            <span className="h-3 w-px bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
            <span className="text-[11px] text-gray-400">답할 대상 →</span>
            <span className="inline-flex items-center rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-medium text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200">
              {assignee.name} 담당자
            </span>
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            className={
              "inline-flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium transition " +
              (canSend
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-200 text-gray-400 cursor-not-allowed")
            }
          >
            <Send size={11} aria-hidden="true" /> 전송
          </button>
        </div>
        {toast && (
          <p className="mt-2 text-[11px] text-amber-700">{toast}</p>
        )}
      </div>
    </section>
  );
}

function MessageRow({ msg }: { msg: ThreadMessage }) {
  const isApplicant = msg.role === "applicant";
  const tone = isApplicant
    ? {
        avatar: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        label: "신청자",
      }
    : {
        avatar: "bg-orange-50 text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200",
        badge: "bg-orange-50 text-[#993C1D] dark:bg-orange-900/30 dark:text-orange-200",
        label: "담당자",
      };

  return (
    <div className="flex gap-3">
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-medium ring-2 ring-white dark:ring-gray-900 ${tone.avatar}`}
      >
        {initials(msg.authorName)}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
            {msg.authorName}
          </span>
          <span className="text-[10px] text-gray-400">·</span>
          <span className="text-[10px] text-gray-400">{msg.timestamp}</span>
          {!isApplicant && (
            <span
              className={`inline-flex items-center rounded px-1.5 py-px text-[9px] font-medium ${tone.badge}`}
            >
              {tone.label}
            </span>
          )}
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-[13px] leading-relaxed text-gray-800 dark:bg-gray-800/40 dark:text-gray-100">
          {msg.text && <p className="whitespace-pre-wrap">{msg.text}</p>}
          {msg.attachments.length > 0 && (
            <ul className={`flex flex-wrap gap-1.5 ${msg.text ? "mt-2" : ""}`}>
              {msg.attachments.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] dark:border-gray-700 dark:bg-gray-900"
                >
                  <FileIcon size={11} aria-hidden="true" className="text-gray-400" />
                  <span className="text-gray-800 dark:text-gray-100">{a.name}</span>
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
