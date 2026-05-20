/**
 * 관리자 메모 카드 — 거버넌스 요청 관리(관리자 상세) 화면에서 활동 카드 옆에 표시.
 *
 * - 신청자에게 절대 노출되지 않음 (호출 라우트가 admin 권한 가드).
 * - 날짜별 1 entry. 오늘 / 과거 모두 contenteditable.
 * - 800ms debounce 자동 저장. content 가 비면 DELETE.
 * - 작성자/수정자 스냅샷은 백엔드가 PUT 마다 갱신.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Edit3, Lock, NotebookPen, Check } from "lucide-react";
import { api, type AdminMemoEntry, type Me } from "@/lib/governance/api-client-full";

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

type SaveState = "idle" | "saving" | "saved";

export function AdminMemoCard({ formId, me }: Props) {
  const [entries, setEntries] = useState<AdminMemoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  // date → 입력 중인 content (편집 중 텍스트). 미사용 날짜는 키 없음.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const today = useMemo(todayKey, []);
  const myEmail = me?.user.email.toLowerCase();

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

  // 컴포넌트 unmount 시 타이머 정리.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // 백엔드 entries + 오늘 빈 슬롯을 합쳐 렌더용 목록 생성.
  const renderedDates = useMemo(() => {
    const dates = new Set(entries.map((e) => e.date));
    dates.add(today);
    return Array.from(dates).sort();
  }, [entries, today]);

  const entryByDate = useMemo(() => {
    const m = new Map<string, AdminMemoEntry>();
    entries.forEach((e) => m.set(e.date, e));
    return m;
  }, [entries]);

  const scheduleSave = useCallback(
    (date: string, content: string) => {
      const existingTimer = timersRef.current[date];
      if (existingTimer) clearTimeout(existingTimer);

      setSaveState("saving");
      timersRef.current[date] = setTimeout(async () => {
        try {
          if (content.trim().length === 0) {
            await api.deleteAdminMemo(formId, date);
          } else {
            await api.upsertAdminMemo(formId, date, content);
          }
          setLastSavedAt(new Date().toISOString());
          setSaveState("saved");
          await refetch();
        } catch (e) {
          console.error("[AdminMemoCard] save failed", e);
          setSaveState("idle");
        }
      }, 800);
    },
    [formId, refetch],
  );

  const onInput = (date: string, e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.innerText;
    setDrafts((prev) => ({ ...prev, [date]: text }));
    scheduleSave(date, text);
  };

  return (
    <aside className="flex flex-col rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-5 py-4">
      {/* 헤더 */}
      <header className="mb-3 flex items-center gap-2">
        <NotebookPen size={14} className="text-[#92400e]" aria-hidden="true" />
        <h2 className="text-[15px] font-medium text-[#92400e]">관리자 메모</h2>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#fcd34d] bg-[#fef3c7] px-2 py-0.5 text-[10px] font-medium text-[#92400e]">
          <Lock size={10} aria-hidden="true" /> 신청자 비공개
        </span>
      </header>

      {/* 본문 — 날짜별 섹션 */}
      <div className="flex-1 space-y-3.5 overflow-y-auto">
        {loading ? (
          <p className="py-6 text-center text-[11px] text-[#b45309]">불러오는 중…</p>
        ) : (
          renderedDates.map((date) => {
            const entry = entryByDate.get(date);
            const isToday = date === today;
            const draft = drafts[date];
            const initial = entry?.content ?? "";
            const isMine = entry
              ? entry.lastUpdatedById === me?.user.id ||
                (myEmail &&
                  entry.lastUpdatedByName &&
                  // 이메일 일치 못 잡을 경우의 보조 — 이름 표기만 사용.
                  false)
              : true;
            return (
              <section key={date} className="space-y-1.5">
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

                {/* 메모 블록 (contenteditable) */}
                <div
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder={
                    isToday ? "오늘의 메모를 입력하세요..." : "메모 내용을 입력하세요..."
                  }
                  onInput={(e) => onInput(date, e)}
                  className={
                    "mx-1 min-h-[40px] whitespace-pre-wrap rounded-md px-3 py-2 text-[13px] leading-7 text-[#78350f] outline-none transition " +
                    (isToday
                      ? "border border-[#fcd34d] bg-white focus:border-[#d97706] focus:bg-[#fffef7]"
                      : "border-l-2 border-[#fde68a] bg-[#fef3c799] focus:border-[#d97706] focus:bg-[#fffef7]") +
                    " admin-memo-block"
                  }
                  // SSR/CSR mismatch 회피 — initial content 만 1회 주입.
                  dangerouslySetInnerHTML={
                    draft === undefined ? { __html: escapeHtml(initial) } : undefined
                  }
                />

                {/* 작성자 도장 */}
                {entry && (
                  <div className="mx-1 flex items-center gap-1 text-[10px] text-[#b45309]">
                    <Edit3 size={10} aria-hidden="true" />
                    <span>
                      {entry.lastUpdatedByName}
                      {isMine ? " (나)" : ""} · {formatHHMM(entry.lastUpdatedAt)}
                    </span>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* 푸터 */}
      <footer className="-mx-5 -mb-4 mt-3 flex items-center justify-between border-t border-[#fde68a] bg-[#fef3c7] px-5 py-2 text-[11px] text-[#b45309]">
        <span className="inline-flex items-center gap-1">
          {saveState === "saving" ? (
            <>
              <span className="inline-block h-2 w-2 animate-spin rounded-full border border-[#b45309] border-t-transparent" />
              저장 중...
            </>
          ) : saveState === "saved" ? (
            <>
              <Check size={11} className="text-emerald-700" aria-hidden="true" />
              <span className="text-emerald-700">
                저장됨 · {lastSavedAt ? formatHHMM(lastSavedAt) : "방금"}
              </span>
            </>
          ) : (
            <span className="text-[#b45309]/70">자동 저장됩니다</span>
          )}
        </span>
        <span className="inline-flex items-center gap-1">
          <Lock size={10} aria-hidden="true" /> 신청자에게 보이지 않습니다
        </span>
      </footer>
    </aside>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
