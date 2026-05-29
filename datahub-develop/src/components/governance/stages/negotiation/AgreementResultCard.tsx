// 합의 결과 카드 — 협의 단계 핵심. 담당자가 채팅 합의 내용을 4필드로 정리(인라인 편집).
//
// 권한:
//   담당자(canEdit) — 셀 클릭 → 인라인 input, Enter/blur 저장(입력 중 300ms debounce 자동 저장).
//                     빈칸은 "+ 클릭해서 입력", 작성된 셀은 호버 시 Pencil 노출.
//   신청자          — 읽기 전용. 빈칸은 "—", "자동 저장" 라벨 미노출.
//   잠김(locked)    — 편집 불가 + 잠금 안내. 4필드 고정(증감 금지).
//
// 저장은 부모(NegotiationStageTab) 가 lib/negotiation-storage 로 영속. 본 카드는 표시 + 편집 위임.

"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, Pencil, Save } from "lucide-react";
import {
  formatAmount,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";

interface FieldConfig {
  key: NegotiationField;
  label: string;
  /** 표시 전용 포맷터 (금액 → 1,200,000원). 편집 input 은 원문 사용. */
  format?: (v: string) => string;
  /** 작업 건수처럼 신청서에서 자동 채운 필드 표기. */
  autoFilledHint?: string;
}

const FIELD_CONFIG: readonly FieldConfig[] = [
  { key: "selectedVendor", label: "선정 업체" },
  { key: "amount", label: "금액", format: formatAmount },
  { key: "period", label: "작업 기간" },
  { key: "workCount", label: "작업 건수", autoFilledHint: "신청서 자동 채움" },
];

interface Props {
  value: NegotiationResult;
  /** 담당자 && !locked 일 때만 true. */
  canEdit: boolean;
  /** 잠김 여부 — 계약 단계 전환 후 true. */
  locked: boolean;
  /** 4필드 중 하나 저장. */
  onField: (key: NegotiationField, next: string) => void;
}

export function AgreementResultCard({ value, canEdit, locked, onField }: Props) {
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]"
        />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          합의 결과
        </h3>
        {locked ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Lock size={12} aria-hidden="true" /> 합의 결과 잠김 (계약 단계 진행됨)
          </span>
        ) : canEdit ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Save size={12} aria-hidden="true" /> 자동 저장 (담당자만)
          </span>
        ) : null}
      </header>
      <p className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        채팅에서 합의된 최종 내용을 정리합니다. 담당자가 직접 입력하며, 다 채우지 않아도 자동 저장됩니다.
      </p>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
        <table className="w-full text-[12px]">
          <tbody>
            {FIELD_CONFIG.map((f, i) => (
              <tr
                key={f.key}
                className={
                  i < FIELD_CONFIG.length - 1
                    ? "border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)]"
                    : ""
                }
              >
                <td className="w-[120px] bg-[var(--color-background-secondary,#f9fafb)] px-3 py-[9px] align-middle text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {f.label}
                </td>
                <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <AgreementCell
                      value={value[f.key]}
                      canEdit={canEdit}
                      emptyEditable="+ 클릭해서 입력"
                      emptyReadonly="—"
                      format={f.format}
                      onCommit={(next) => onField(f.key, next)}
                    />
                    {f.autoFilledHint && (
                      <span className="shrink-0 text-[10px] text-gray-400">
                        {f.autoFilledHint}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-gray-400">
        {canEdit
          ? "담당자: 빈칸 클릭 시 인라인 편집 모드, Enter 또는 포커스 해제 시 저장"
          : "신청자: 읽기 전용, 빈칸은 “—” 로 표시"}
      </p>
    </section>
  );
}

/** 인라인 편집 셀 — 카드/모달 공용.
 *  - 편집 가능 + 빈칸: emptyEditable 문구(클릭 시 input).
 *  - 읽기 전용 + 빈칸: emptyReadonly 문구.
 *  - 작성된 셀(편집 가능): 호버 시 Pencil 노출, 클릭 시 재편집.
 *  - 편집: onChange 300ms debounce 자동 저장 + Enter/blur 즉시 커밋. */
export function AgreementCell({
  value,
  canEdit,
  emptyEditable,
  emptyReadonly = "—",
  format,
  onCommit,
}: {
  value: string;
  canEdit: boolean;
  emptyEditable: string;
  emptyReadonly?: string;
  format?: (v: string) => string;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 외부 값 변경(다른 화면/모달에서 저장) 시 비편집 상태면 동기화.
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
      className="group inline-flex w-full items-center gap-1.5 rounded text-left transition hover:bg-gray-50/60 dark:hover:bg-gray-800/40"
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
      ) : (
        <span className="text-gray-400">{emptyEditable}</span>
      )}
    </button>
  );
}
