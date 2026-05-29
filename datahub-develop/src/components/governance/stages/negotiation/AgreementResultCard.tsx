// 최종 협의 내용 카드 — 협의 단계 핵심. 담당자가 협의 내용을 4필드로 정리(인라인 편집).
//
// 권한:
//   담당자(canEdit) — 셀 클릭 → 인라인 input, Enter/blur 저장(입력 중 300ms debounce 자동 저장).
//                     빈칸은 "+ 클릭해서 입력", 작성된 셀은 호버 시 Pencil 노출.
//   신청자          — 읽기 전용. 빈칸은 "—", "자동 저장 (담당자만)" 라벨 미노출.
//   [다운로드 ▾]    — 양쪽 모두 노출. 엑셀(.xlsx) / PDF(.pdf) 선택 다운로드(부모 onDownload 위임).
//   4필드 고정(증감 금지). 협의 단계엔 잠금 없음.
//
// 저장은 부모(NegotiationStageTab) 가 lib/negotiation-storage 로 영속. 본 카드는 표시 + 편집 위임.

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Download, Pencil, Save } from "lucide-react";
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
  /** 인라인 편집 가능 여부(담당자). */
  canEdit: boolean;
  /** 4필드 중 하나 저장. */
  onField: (key: NegotiationField, next: string) => void;
  /** 다운로드 — 엑셀/PDF. 양쪽 역할 모두 호출 가능. */
  onDownload: (format: "xlsx" | "pdf") => void;
}

export function AgreementResultCard({ value, canEdit, onField, onDownload }: Props) {
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]"
        />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          최종 협의 내용
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <DownloadMenu onDownload={onDownload} />
          {canEdit && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Save size={12} aria-hidden="true" /> 자동 저장 (담당자만)
            </span>
          )}
        </div>
      </header>
      <p className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        최종 협의된 내용을 작성합니다. 담당자가 직접 입력합니다.
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

/** [다운로드 ▾] 드롭다운 — 엑셀(.xlsx) / PDF(.pdf). 외부 클릭·ESC 로 닫힘.
 *  계약 단계 AgreementCard 에서도 재사용. */
export function DownloadMenu({
  onDownload,
}: {
  onDownload: (format: "xlsx" | "pdf") => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(format: "xlsx" | "pdf"): void {
    setOpen(false);
    onDownload(format);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex items-center gap-1 rounded-[7px] border-[0.5px] px-2.5 py-[5px] text-[11px] transition ${
          open
            ? "border-[#D4533E] text-[#D4533E]"
            : "border-[var(--color-border-secondary,#d1d5db)] text-gray-600 hover:text-gray-800 dark:text-gray-300"
        }`}
      >
        <Download size={12} aria-hidden="true" />
        다운로드
        {open ? (
          <ChevronUp size={12} aria-hidden="true" />
        ) : (
          <ChevronDown size={12} aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-[180px] rounded-lg border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-1 dark:border-gray-700 dark:bg-gray-900"
          style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        >
          <DownloadItem
            label="엑셀 (.xlsx)"
            badge="XLS"
            badgeColor="#3B6D11"
            onClick={() => pick("xlsx")}
          />
          <DownloadItem
            label="PDF (.pdf)"
            badge="PDF"
            badgeColor="#A32D2D"
            onClick={() => pick("pdf")}
          />
        </div>
      )}
    </div>
  );
}

function DownloadItem({
  label,
  badge,
  badgeColor,
  onClick,
}: {
  label: string;
  badge: string;
  badgeColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-gray-700 transition hover:bg-[var(--color-background-secondary,#f3f4f6)] dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <span
        className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-[8px] font-medium text-white"
        style={{ background: badgeColor }}
        aria-hidden="true"
      >
        {badge}
      </span>
      {label}
    </button>
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
