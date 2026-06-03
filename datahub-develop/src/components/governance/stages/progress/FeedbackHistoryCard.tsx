// 피드백 이력 카드 — 진행 단계 페이지 전체 폭(페이지의 핵심).
//   표 6컬럼: 납품 구분 / 데이터 수령일 / 작성일시 / 내용 요약 / 첨부 / 펼침.
//   헤더에 [+ 피드백 작성] 버튼. 행 클릭 시 인라인 펼침(다른 행은 접힘 유지).

"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MessageSquare, Paperclip, Plus } from "lucide-react";
import {
  deliveryColors,
  deliveryLabel,
  formatBytes,
  formatDateTime,
  readFeedbackHistory,
  type FeedbackItem,
} from "@/lib/governance/feedback-storage";

interface Props {
  formId: string;
  /** 헤더 [+ 피드백 작성] — 부모가 작성 모달을 연다. */
  onCompose: () => void;
}

export function FeedbackHistoryCard({ formId, onCompose }: Props) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    function refresh(): void {
      setItems(readFeedbackHistory(formId));
    }
    refresh();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ formId?: string }>).detail;
      if (!detail || detail.formId === formId) refresh();
    };
    window.addEventListener("dh:gov:feedback-changed", onChange);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("dh:gov:feedback-changed", onChange);
      window.removeEventListener("focus", refresh);
    };
  }, [formId]);

  // 표시 정렬 — 최신 위(작성일시 desc).
  const sorted = useMemo(() => {
    const copy = items.slice();
    copy.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return copy;
  }, [items]);

  return (
    <section className="rounded-[11px] border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[15px] py-[13px] dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
          피드백 이력
        </h3>
        <span
          className="inline-flex items-center text-[10px]"
          style={{
            background: "var(--color-background-secondary,#f3f4f6)",
            color: "var(--color-text-secondary,#6b7280)",
            borderRadius: 5,
            padding: "1px 7px",
          }}
        >
          {items.length}건
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCompose}
            className="inline-flex items-center gap-1 rounded-md bg-[#D4533E] px-2.5 py-1 text-[10px] font-medium text-white transition hover:brightness-110"
          >
            <Plus size={12} aria-hidden="true" /> 피드백 작성
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr
              className="text-left"
              style={{
                background: "var(--color-background-secondary,#f3f4f6)",
                color: "var(--color-text-secondary,#6b7280)",
              }}
            >
              <Th width="90px">납품 구분</Th>
              <Th width="100px">데이터 수령일</Th>
              <Th width="130px">작성일시</Th>
              <Th>내용 요약</Th>
              <Th width="60px" align="center">첨부</Th>
              <Th width="32px" align="center" />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: "30px 12px" }}>
                  <div className="flex flex-col items-center justify-center gap-1 text-center">
                    <MessageSquare
                      size={24}
                      aria-hidden="true"
                      className="text-[var(--color-text-tertiary,#9ca3af)]"
                    />
                    <p className="text-[11px] text-[var(--color-text-secondary,#6b7280)]">
                      아직 작성된 피드백이 없습니다.
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary,#9ca3af)]">
                      상단 [+ 피드백 작성] 버튼으로 작성할 수 있습니다.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sorted.map((it) => (
                <FeedbackRow
                  key={it.id}
                  item={it}
                  expanded={expandedId === it.id}
                  onToggle={() =>
                    setExpandedId((cur) => (cur === it.id ? null : it.id))
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  width,
  align = "left",
}: {
  children?: React.ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className="border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] px-2.5 py-1.5 font-medium"
      style={{ width, textAlign: align }}
    >
      {children}
    </th>
  );
}

function FeedbackRow({
  item,
  expanded,
  onToggle,
}: {
  item: FeedbackItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const dc = deliveryColors(item.deliveryRound);
  const summary =
    item.content && item.content.trim().length > 0
      ? item.content.split("\n")[0]
      : `(문서 ${item.attachments.length}개 첨부)`;
  const isAttachOnly = !item.content || item.content.trim().length === 0;

  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] transition hover:bg-gray-50/40 dark:hover:bg-gray-800/40"
        style={expanded ? { background: "#FCF8EF" } : undefined}
      >
        <Td>
          <span
            className="inline-flex items-center text-[9px] font-medium"
            style={{ background: dc.bg, color: dc.text, borderRadius: 4, padding: "2px 6px" }}
          >
            {deliveryLabel(item.deliveryRound)}
          </span>
        </Td>
        <Td>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.receivedDate}</span>
        </Td>
        <Td>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatDateTime(item.createdAt)}
          </span>
        </Td>
        <Td>
          <span
            className="block truncate"
            style={
              isAttachOnly
                ? { fontStyle: "italic", color: "var(--color-text-tertiary,#9ca3af)" }
                : undefined
            }
            title={summary}
          >
            {summary}
          </span>
        </Td>
        <Td align="center">
          {item.attachments.length > 0 ? (
            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
              <Paperclip size={11} aria-hidden="true" /> {item.attachments.length}
            </span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </Td>
        <Td align="center">
          {expanded ? (
            <ChevronUp size={13} aria-hidden="true" style={{ color: "#D4533E" }} />
          ) : (
            <ChevronDown size={13} aria-hidden="true" className="text-gray-400" />
          )}
        </Td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)]">
            <div
              className="px-[14px] py-[11px]"
              style={{ borderTop: "1px dashed var(--color-border-tertiary,#e5e7eb)" }}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                <span
                  className="inline-flex items-center text-[9px] font-medium"
                  style={{
                    background: dc.bg,
                    color: dc.text,
                    borderRadius: 4,
                    padding: "2px 6px",
                  }}
                >
                  {deliveryLabel(item.deliveryRound)}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  수령일 {item.receivedDate}
                </span>
                <span>·</span>
                <span>{item.author}</span>
                <span>·</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatDateTime(item.createdAt)}
                </span>
              </div>
              {item.content && item.content.trim().length > 0 && (
                <div
                  className="mb-2 whitespace-pre-wrap break-words rounded-md px-3 py-2.5 text-[11px] leading-relaxed text-gray-800 dark:text-gray-100"
                  style={{ background: "#FCF3F0", border: "0.5px solid #EFC4B9" }}
                >
                  {item.content}
                </div>
              )}
              {item.attachments.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {item.attachments.map((a) => (
                    <li
                      key={`${a.name}-${a.size}`}
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-100 px-2 py-1 text-[10px] dark:border-gray-800"
                    >
                      <Paperclip size={10} aria-hidden="true" className="text-gray-400" />
                      <span className="text-gray-800 dark:text-gray-100">{a.name}</span>
                      <span className="text-gray-400">{formatBytes(a.size)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Td({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td className="px-2.5 py-2 align-middle" style={{ textAlign: align }}>
      {children}
    </td>
  );
}
