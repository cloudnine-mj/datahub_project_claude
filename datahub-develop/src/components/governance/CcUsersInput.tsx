// 참조자(CC users) 입력 — 이름 칩 리스트. 두 모드 공용.
//   inline: 신청서 폼 행 안 — input + [추가] 한 줄 + 아래 칩 목록(항상 입력칸 노출).
//   card:   협의 단계 카드 본문 — 3상태(있음/없음/입력 모드), [+ 참조자 추가] 점선 토글.
//
// 이름만 다룬다(이메일·검색 없음). trim 후 빈 값/중복(대소문자 무시)/50자 초과는 추가 막음.
// Phase 1: 권한 분기 없음 — 모든 사용자 추가/제거 가능. 안내 문구 없음.

"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { addCcUser, removeCcUser } from "@/lib/governance/cc-users-storage";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  mode: "inline" | "card";
}

export function CcUsersInput({ value, onChange, mode }: Props) {
  if (mode === "inline") {
    return <InlineMode value={value} onChange={onChange} />;
  }
  return <CardMode value={value} onChange={onChange} />;
}

/** 파란 참조자 칩 — 이름 + X 제거. */
function CcChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px]"
      style={{
        background: "#E6F1FB",
        color: "#0C447C",
        borderRadius: 14,
        padding: "3px 6px 3px 10px",
      }}
    >
      {name}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${name} 제거`}
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-white transition hover:brightness-110"
        style={{ background: "#0C447C" }}
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
  );
}

/** 신청서 폼 행 — input + [추가] 한 줄, 아래 칩 목록(입력칸 항상 노출). */
function InlineMode({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [dupFlash, setDupFlash] = useState(false);

  function commit() {
    const next = addCcUser(value, draft);
    if (next === value) {
      // 추가 실패(빈 값/중복/길이초과) — 중복일 때만 빨강 테두리 잠깐.
      if (draft.trim().length > 0) {
        setDupFlash(true);
        window.setTimeout(() => setDupFlash(false), 800);
      }
      return;
    }
    onChange(next);
    setDraft("");
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDupFlash(false);
          }}
          onKeyDown={onKey}
          placeholder="참조자 이름을 입력하고 Enter"
          className={`flex-1 rounded-md border-[0.5px] bg-white px-2.5 py-[5px] text-[11px] text-gray-900 focus:outline-none dark:bg-gray-900 dark:text-gray-100 ${
            dupFlash
              ? "border-[#D4533E]"
              : "border-[var(--color-border-tertiary,#e5e7eb)] focus:border-[#D4533E]"
          }`}
        />
        <button
          type="button"
          onClick={commit}
          className="shrink-0 rounded-md border-[0.5px] border-[var(--color-border-secondary,#d1d5db)] bg-white px-3 py-[5px] text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          추가
        </button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((n) => (
            <CcChip key={n} name={n} onRemove={() => onChange(removeCcUser(value, n))} />
          ))}
        </div>
      )}
    </div>
  );
}

/** 협의 단계 카드 본문 — 3상태(있음/없음/입력 모드). 카드 래퍼(테두리·헤더)는 CcUsersCard 가 담당.
 *  여기서는 칩 + [+ 참조자 추가] 점선 버튼 / 입력 영역만 렌더하고, 입력 모드 여부를 부모에 알린다. */
function CardMode({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <CardModeBody value={value} onChange={onChange} editing={false} onEditingChange={() => {}} />
  );
}

/** CcUsersCard 가 헤더의 '추가 중' 뱃지·테두리 강조를 위해 editing 상태를 공유해야 하므로,
 *  실제 본문은 editing 을 prop 으로 받는 별도 컴포넌트로 분리해 카드가 제어한다. */
export function CardModeBody({
  value,
  onChange,
  editing,
  onEditingChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  editing: boolean;
  onEditingChange: (next: boolean) => void;
}) {
  const [draft, setDraft] = useState("");
  const [dupFlash, setDupFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    const next = addCcUser(value, draft);
    if (next === value) {
      if (draft.trim().length > 0) {
        setDupFlash(true);
        window.setTimeout(() => setDupFlash(false), 800);
      }
      return;
    }
    onChange(next);
    setDraft("");
    inputRef.current?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing || e.key === "Process") return;
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setDraft("");
      onEditingChange(false);
    }
  }

  const openInput = () => {
    onEditingChange(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((n) => (
          <CcChip key={n} name={n} onRemove={() => onChange(removeCcUser(value, n))} />
        ))}
        {!editing && (
          <button
            type="button"
            onClick={openInput}
            className="inline-flex items-center gap-1 rounded-[14px] border-[0.5px] border-dashed border-[var(--color-border-secondary,#d1d5db)] px-[9px] py-[3px] text-[11px] text-gray-500 transition hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <Plus size={11} aria-hidden="true" /> 참조자 추가
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-2.5 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setDupFlash(false);
            }}
            onKeyDown={onKey}
            placeholder="참조자 이름을 입력하고 Enter"
            className={`flex-1 rounded-md border-[0.5px] bg-white px-2.5 py-[5px] text-[11px] text-gray-900 focus:outline-none dark:bg-gray-900 dark:text-gray-100 ${
              dupFlash ? "border-[#D4533E]" : "border-[#D4533E]"
            }`}
          />
          <button
            type="button"
            onClick={commit}
            className="shrink-0 rounded-md bg-[#D4533E] px-3 py-[5px] text-[11px] font-medium text-white transition hover:brightness-110"
          >
            추가
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft("");
              onEditingChange(false);
            }}
            className="shrink-0 rounded-md border-[0.5px] border-[var(--color-border-secondary,#d1d5db)] bg-transparent px-3 py-[5px] text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
