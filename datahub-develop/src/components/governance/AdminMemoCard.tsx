/**
 * 관리자 메모 카드 — 거버넌스 요청 관리(관리자 상세) 화면 우측에 표시.
 *
 * - 신청자에게 절대 노출되지 않음 (호출 라우트가 admin 권한 가드).
 * - 평소 읽기 전용, "수정" 버튼 클릭 시에만 편집 모드 진입 (자동 저장 X).
 * - 편집 모드에서 "저장하기" 클릭 또는 Cmd/Ctrl+Enter → PUT.
 * - 휴지통은 두 모드 모두 노출, confirm 후 DELETE.
 * - 편집 중인 블록이 있으면 페이지 이탈 시 beforeunload confirm.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  Edit3,
  Lock,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  api,
  type AdminMemoEntry,
  type Me,
} from "@/lib/governance/api-client-full";

interface Props {
  formId: string;
  me: Me | null;
}

function todayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateKR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(y, m - 1, d);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

function formatHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function AdminMemoCard({ formId, me }: Props) {
  const [entries, setEntries] = useState<AdminMemoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  // 편집 중인 날짜 집합. 진입 시 빈 Set.
  const [editing, setEditing] = useState<Set<string>>(new Set());
  // 편집 중 텍스트 buffer — 날짜별. 편집 진입 시 entry.content 로 초기화.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const today = useMemo(todayKey, []);

  const refetch = useCallback(async () => {
    try {
      const list = await api.listAdminMemo(formId);
      setEntries(list);
    } catch (e) {
      console.error("[AdminMemoCard] listAdminMemo failed", e);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  // 편집 중인 블록이 있는 채로 페이지 이탈 시 confirm.
  useEffect(() => {
    if (editing.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [editing.size]);

  const entryByDate = useMemo(() => {
    const m = new Map<string, AdminMemoEntry>();
    entries.forEach((e) => m.set(e.date, e));
    return m;
  }, [entries]);

  const renderedDates = useMemo(() => {
    const dates = new Set(entries.map((e) => e.date));
    dates.add(today);
    return Array.from(dates).sort();
  }, [entries, today]);

  const startEdit = (date: string) => {
    setDrafts((prev) => ({
      ...prev,
      [date]: entryByDate.get(date)?.content ?? "",
    }));
    setEditing((prev) => {
      const next = new Set(prev);
      next.add(date);
      return next;
    });
  };

  const cancelEdit = (date: string) => {
    setEditing((prev) => {
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  };

  const save = async (date: string) => {
    const content = drafts[date] ?? "";
    setSaving((prev) => new Set(prev).add(date));
    try {
      if (content.trim().length === 0) {
        // 내용이 비어있는데 저장 누르면 해당 엔트리 제거.
        await api.deleteAdminMemo(formId, date);
      } else {
        await api.upsertAdminMemo(formId, date, content);
      }
      await refetch();
      cancelEdit(date);
    } catch (e) {
      console.error("[AdminMemoCard] save failed", e);
      alert("저장에 실패했습니다.");
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(date);
        return next;
      });
    }
  };

  const remove = async (date: string) => {
    if (!window.confirm(`${formatDateKR(date)} 메모를 삭제하시겠습니까?`)) return;
    try {
      await api.deleteAdminMemo(formId, date);
      cancelEdit(date);
      await refetch();
    } catch (e) {
      console.error("[AdminMemoCard] delete failed", e);
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <aside className="flex flex-col rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-5 py-4 min-h-[540px]">
      {/* 헤더 */}
      <header className="mb-3 flex items-center gap-2">
        <NotebookPen size={14} className="text-[#92400e]" aria-hidden="true" />
        <h2 className="text-[15px] font-medium text-[#92400e]">관리자 메모</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#fcd34d] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-medium text-[#92400e]">
          <Lock size={10} aria-hidden="true" /> 신청자 비공개
        </span>
      </header>

      {/* 본문 */}
      <div className="flex-1 space-y-4 overflow-y-auto">
        {loading ? (
          <p className="py-6 text-center text-[11px] text-[#b45309]">불러오는 중…</p>
        ) : (
          renderedDates.map((date) => {
            const entry = entryByDate.get(date);
            const isToday = date === today;
            const isEditing = editing.has(date);
            const isSaving = saving.has(date);
            const isMine = entry && entry.lastUpdatedById === me?.user.id;
            return (
              <MemoDaySection
                key={date}
                date={date}
                isToday={isToday}
                entry={entry}
                isEditing={isEditing}
                isSaving={isSaving}
                isMine={!!isMine}
                draft={drafts[date]}
                onDraftChange={(v) =>
                  setDrafts((prev) => ({ ...prev, [date]: v }))
                }
                onEdit={() => startEdit(date)}
                onSave={() => void save(date)}
                onDelete={() => void remove(date)}
              />
            );
          })
        )}
      </div>

      {/* 카드 푸터 */}
      <footer className="-mx-5 -mb-4 mt-3 flex items-center justify-between border-t border-[#fde68a] bg-[#fef3c7] px-5 py-2 text-[11px] text-[#b45309]">
        <span className="inline-flex items-center gap-1">
          {editing.size > 0 ? (
            <>
              <Edit3 size={11} aria-hidden="true" /> 편집 중
            </>
          ) : (
            <>
              <Check size={11} className="text-emerald-700" aria-hidden="true" />
              <span className="text-emerald-700">저장됨</span>
            </>
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <Lock size={10} aria-hidden="true" /> 신청자에게 보이지 않습니다
        </span>
      </footer>
    </aside>
  );
}

interface DayProps {
  date: string;
  isToday: boolean;
  entry: AdminMemoEntry | undefined;
  isEditing: boolean;
  isSaving: boolean;
  isMine: boolean;
  draft: string | undefined;
  onDraftChange: (v: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}

function MemoDaySection({
  date,
  isToday,
  entry,
  isEditing,
  isSaving,
  isMine,
  draft,
  onDraftChange,
  onEdit,
  onSave,
  onDelete,
}: DayProps) {
  const blockRef = useRef<HTMLDivElement>(null);

  // 편집 모드 진입 시 자동 포커스 + 커서를 텍스트 끝으로.
  useEffect(() => {
    if (!isEditing) return;
    const el = blockRef.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    if (sel) {
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [isEditing]);

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    onDraftChange(e.currentTarget.innerText);
  };

  // Cmd/Ctrl + Enter → 저장. 일반 Enter 는 줄바꿈 유지.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSave();
    }
  };

  const content = isEditing ? draft ?? "" : entry?.content ?? "";
  const isEmpty = content.length === 0;

  return (
    <section className="space-y-1.5">
      {/* 날짜 헤더 */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-[#fde68a]" aria-hidden="true" />
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium " +
            (isToday
              ? "bg-[#fed7aa] text-[#9a3412]"
              : "bg-[#fef3c7] text-[#b45309]")
          }
        >
          <Calendar size={10} aria-hidden="true" />
          {formatDateKR(date)}
        </span>
        {isToday && (
          <span className="rounded-md bg-[#d97706] px-1.5 py-[1px] text-[9px] font-medium text-white">
            오늘
          </span>
        )}
        <div className="h-px flex-1 bg-[#fde68a]" aria-hidden="true" />
      </div>

      {/* 메모 블록 */}
      <div
        ref={blockRef}
        contentEditable={isEditing}
        suppressContentEditableWarning
        data-placeholder={
          isEditing ? "오늘의 메모를 입력하세요..." : "메모 없음"
        }
        onInput={onInput}
        onKeyDown={onKeyDown}
        className={
          "admin-memo-block mx-1 min-h-[50px] whitespace-pre-wrap break-words rounded-md px-3 py-2.5 text-[13px] leading-7 text-[#78350f] transition " +
          (isEditing
            ? "border border-[#d97706] bg-white outline-none focus:bg-[#fffef7]"
            : "border border-transparent bg-white/50 cursor-default")
        }
        // entry.content 가 바뀔 때 (refetch 후) DOM 을 갱신.
        // 편집 중에는 React 가 DOM 을 덮어쓰지 않도록 key 로 강제 remount.
        key={
          isEditing ? `edit-${date}` : `view-${date}-${entry?.revisionCount ?? 0}`
        }
        dangerouslySetInnerHTML={{
          __html: isEmpty && !isEditing ? "" : escapeHtml(content),
        }}
      />

      {/* 블록 푸터 */}
      <div className="mx-1 mt-1.5 flex min-h-[26px] items-center justify-between">
        <span className="inline-flex items-center gap-1 text-[10px] text-[#b45309]">
          {entry && (
            <>
              <Edit3 size={10} aria-hidden="true" />
              <span>
                {entry.lastUpdatedByName}
                {isMine ? " (나)" : ""}
                {entry.lastUpdatedAt ? ` · ${formatHHMM(entry.lastUpdatedAt)}` : ""}
              </span>
            </>
          )}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {isEditing ? (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1 rounded-md bg-[#d97706] px-3 py-1 text-[11px] font-medium text-white transition hover:bg-[#b45309] disabled:opacity-60"
            >
              <Check size={11} aria-hidden="true" />
              {isSaving ? "저장 중…" : "저장하기"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 rounded-md border border-[#fcd34d] bg-transparent px-3 py-1 text-[11px] font-medium text-[#b45309] transition hover:bg-[#fef3c7]"
            >
              <Pencil size={11} aria-hidden="true" />
              수정
            </button>
          )}
          {entry && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`${formatDateKR(date)} 메모 삭제`}
              className="inline-flex items-center rounded-md border border-[#fecaca] bg-transparent px-2 py-1 text-[#dc2626] transition hover:bg-[#fef2f2]"
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          )}
        </span>
      </div>
    </section>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
