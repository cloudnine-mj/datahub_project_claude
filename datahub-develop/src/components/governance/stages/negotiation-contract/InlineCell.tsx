// 인라인 편집 셀 — 협의·계약 통합 단계의 표 셀 공용.
//   - 편집 가능 + 빈칸: emptyEditable 문구(클릭 시 input).
//   - 작성된 셀: 호버 시 Pencil 노출, 클릭 시 재편집.
//   - 편집: onChange 300ms debounce 자동 저장 + Enter/blur 즉시 커밋, Esc 취소.
//   - 읽기 전용(canEdit=false): 값 또는 emptyReadonly("—") 표시.

"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { InputCursor } from "@/components/common/InputCursor";

export function InlineCell({
  value,
  canEdit = true,
  emptyEditable = "",
  emptyReadonly = "—",
  format,
  onCommit,
}: {
  value: string;
  canEdit?: boolean;
  /** 편집 가능 + 빈칸일 때 보일 안내 텍스트. 빈 문자열(기본)이면 깜빡이는 커서만 표시. */
  emptyEditable?: string;
  emptyReadonly?: string;
  format?: (v: string) => string;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  function scheduleSave(next: string): void {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onCommit(next), 300);
  }

  function commitNow(next: string): void {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onCommit(next);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          scheduleSave(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            commitNow(draft);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        onBlur={() => {
          commitNow(draft);
          setEditing(false);
        }}
        className="w-full rounded border border-[#D4533E] bg-white px-2 py-1 text-[12px] text-gray-900 focus:outline-none dark:bg-gray-800 dark:text-gray-100"
      />
    );
  }

  const hasValue = value.trim().length > 0;
  const display = hasValue ? (format ? format(value) : value) : "";

  if (!canEdit) {
    return hasValue ? (
      <span>{display}</span>
    ) : (
      <span className="text-gray-400">{emptyReadonly}</span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="group inline-flex w-full cursor-text items-center gap-1.5 rounded text-left transition hover:bg-[#FCF8EF] dark:hover:bg-[#FCF8EF]/10"
    >
      {hasValue ? (
        <>
          <span className="text-gray-900 dark:text-gray-100">{display}</span>
          <Pencil
            size={11}
            aria-hidden="true"
            className="shrink-0 text-gray-300 opacity-0 transition group-hover:opacity-100"
          />
        </>
      ) : emptyEditable ? (
        // 안내 텍스트가 명시된 경우(예: 모달의 '입력 필요')는 그대로 텍스트 표시.
        <span className="text-gray-400">{emptyEditable}</span>
      ) : (
        // 빈 셀 — '+ 클릭해서 입력' 대신 깜빡이는 커서로 즉시 입력 가능 신호.
        <InputCursor />
      )}
    </button>
  );
}
