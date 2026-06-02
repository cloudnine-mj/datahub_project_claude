// 사용자 선택 드롭다운 — 담당자/참조자 추가 모달에서 공용.
//   이름 입력칸에 타이핑하면 사용자 디렉터리(mock, Phase 2: /users/search)를 검색해
//   드롭다운으로 후보를 보여주고, 선택하면 이름+이메일이 함께 채워진다.
//   목록에 없는 사람은 이름·이메일을 직접 입력할 수 있어 기존 형식을 유지한다.

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { searchUsers, type DirectoryUser } from "@/lib/governance/user-directory";

interface Props {
  name: string;
  email: string;
  onChange: (next: { name: string; email: string }) => void;
  /** Enter 로 즉시 확정(모달 제출) 트리거. */
  onSubmit?: () => void;
}

export function UserPicker({ name, email, onChange, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<DirectoryUser[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // 드롭다운 외부 클릭 시 닫기.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function refresh(q: string): void {
    setResults(searchUsers(q));
    setOpen(true);
  }

  function pick(u: DirectoryUser): void {
    onChange({ name: u.name, email: u.email });
    setOpen(false);
  }

  function onNameKey(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="space-y-3">
      {/* 이름 — 검색 드롭다운 */}
      <div ref={wrapRef} className="relative">
        <label className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
          이름
        </label>
        <div className="relative">
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => {
              onChange({ name: e.target.value, email });
              refresh(e.target.value);
            }}
            onFocus={() => refresh(name)}
            onKeyDown={onNameKey}
            placeholder="이름 검색 또는 직접 입력"
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 pr-8 text-[12px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          <ChevronDown
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>

        {open && results.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-30 mt-1 max-h-[200px] w-full overflow-y-auto rounded-md border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {results.map((u) => {
              const selected = u.email.toLowerCase() === email.toLowerCase();
              return (
                <li key={u.email}>
                  <button
                    type="button"
                    onClick={() => pick(u)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[var(--color-background-secondary,#f3f4f6)] dark:hover:bg-gray-800"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white" style={{ background: "#993C1D" }} aria-hidden="true">
                      {u.name.trim().slice(0, 1) || "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-gray-900 dark:text-gray-100">
                        {u.name}
                      </span>
                      <span className="block truncate text-[10px] text-gray-400">
                        {u.email}
                      </span>
                    </span>
                    {selected && (
                      <Check size={13} aria-hidden="true" className="shrink-0 text-[#D4533E]" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 이메일 — 선택 시 자동 채움, 직접 수정 가능 */}
      <div>
        <label className="mb-1 block text-[11px] text-gray-500 dark:text-gray-400">
          이메일
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => onChange({ name, email: e.target.value })}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.key === "Process") return;
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit?.();
            }
          }}
          placeholder="example@company.com"
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-[12px] focus:border-[#D4533E] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>
    </div>
  );
}
