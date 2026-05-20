/**
 * 관리자 메모 카드 — 거버넌스 요청 관리(관리자 상세) 화면 우측에 표시.
 *
 * - 신청자에게 절대 노출되지 않음 (호출 라우트가 admin 권한 가드).
 * - 모든 블록은 항상 편집 가능 (textarea). 별도 '수정' 버튼 없음.
 * - 변경 사항은 '저장하기' 버튼 클릭 시에만 PUT — 자동 저장 X.
 * - 저장 안 된 변경이 있는 블록은 '미저장' 배지 + 저장 버튼만 활성.
 * - 휴지통은 entry 가 있을 때 항상 노출, confirm 후 DELETE.
 * - 미저장 변경이 1개라도 있는 상태로 페이지 이탈 시 beforeunload 경고.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, Edit3, Lock, NotebookPen, Trash2 } from "lucide-react";
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
  // 날짜별 현재 입력 텍스트. entries 와 다르면 미저장 상태.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const today = useMemo(todayKey, []);

  const refetch = useCallback(async () => {
    try {
      const list = await api.listAdminMemo(formId);
      setEntries(list);
      // refetch 후 drafts 를 서버 값으로 재동기화 (저장된 날짜만).
      setDrafts((prev) => {
        const next = { ...prev };
        list.forEach((e) => {
          next[e.date] = e.content;
        });
        return next;
      });
    } catch (e) {
      console.error("[AdminMemoCard] listAdminMemo failed", e);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const entryByDate = useMemo(() => {
    const m = new Map<string, AdminMemoEntry>();
    entries.forEach((e) => m.set(e.date, e));
    return m;
  }, [entries]);

  // 날짜별 dirty 여부 계산 — draft 가 서버 content 와 다르면 dirty.
  const dirtyDates = useMemo(() => {
    const s = new Set<string>();
    Object.entries(drafts).forEach(([date, content]) => {
      const server = entryByDate.get(date)?.content ?? "";
      if (content !== server) s.add(date);
    });
    return s;
  }, [drafts, entryByDate]);

  // 미저장 변경 있는 상태로 페이지 이탈 시 confirm.
  useEffect(() => {
    if (dirtyDates.size === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtyDates.size]);

  const renderedDates = useMemo(() => {
    const dates = new Set(entries.map((e) => e.date));
    dates.add(today);
    return Array.from(dates).sort();
  }, [entries, today]);

  const save = async (date: string) => {
    const content = drafts[date] ?? "";
    setSaving((prev) => new Set(prev).add(date));
    try {
      if (content.trim().length === 0) {
        // 빈 내용이면 해당 날짜 엔트리 제거.
        await api.deleteAdminMemo(formId, date);
      } else {
        await api.upsertAdminMemo(formId, date, content);
      }
      await refetch();
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
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[date];
        return next;
      });
      await refetch();
    } catch (e) {
      console.error("[AdminMemoCard] delete failed", e);
      alert("삭제에 실패했습니다.");
    }
  };

  return (
    <aside className="flex min-h-[540px] flex-col rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-5 py-4">
      {/* 카드 헤더 */}
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
            const isSaving = saving.has(date);
            const isDirty = dirtyDates.has(date);
            const isMine = entry && entry.lastUpdatedById === me?.user.id;
            return (
              <MemoDaySection
                key={date}
                date={date}
                isToday={isToday}
                entry={entry}
                isSaving={isSaving}
                isDirty={isDirty}
                isMine={!!isMine}
                value={drafts[date] ?? entry?.content ?? ""}
                onChange={(v) =>
                  setDrafts((prev) => ({ ...prev, [date]: v }))
                }
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
          {dirtyDates.size > 0 ? (
            <>
              <Edit3 size={11} aria-hidden="true" />
              저장 안 된 변경 {dirtyDates.size}건
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
  isSaving: boolean;
  isDirty: boolean;
  isMine: boolean;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onDelete: () => void;
}

function MemoDaySection({
  date,
  isToday,
  entry,
  isSaving,
  isDirty,
  isMine,
  value,
  onChange,
  onSave,
  onDelete,
}: DayProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // 내용 변경 시 textarea 높이 자동 조정.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(50, el.scrollHeight)}px`;
  }, [value]);

  // Cmd/Ctrl + Enter → 저장. 일반 Enter 는 줄바꿈 유지.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (isDirty && !isSaving) onSave();
    }
  };

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
        {isDirty && (
          <span className="rounded-md bg-[#fef3c7] px-1.5 py-[1px] text-[9px] font-medium text-[#b45309] ring-1 ring-[#fcd34d]">
            미저장
          </span>
        )}
        <div className="h-px flex-1 bg-[#fde68a]" aria-hidden="true" />
      </div>

      {/* 메모 입력 — 항상 편집 가능 */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={isToday ? "오늘의 메모를 입력하세요..." : "메모 내용을 입력하세요..."}
        rows={2}
        className={
          "mx-1 block w-[calc(100%-0.5rem)] resize-none whitespace-pre-wrap break-words rounded-md px-3 py-2.5 text-[13px] leading-7 text-[#78350f] placeholder:text-[#b45309]/50 outline-none transition " +
          (isDirty
            ? "border border-[#d97706] bg-white focus:bg-[#fffef7]"
            : "border border-[#fde68a]/60 bg-white/60 focus:border-[#d97706] focus:bg-white")
        }
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
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className={
              "inline-flex items-center gap-1 rounded-md px-3 py-1 text-[11px] font-medium transition " +
              (isDirty
                ? "bg-[#d97706] text-white hover:bg-[#b45309] disabled:opacity-60"
                : "cursor-not-allowed border border-[#fde68a] bg-[#fef3c7]/50 text-[#b45309]/50")
            }
          >
            <Check size={11} aria-hidden="true" />
            {isSaving ? "저장 중…" : "저장하기"}
          </button>
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
