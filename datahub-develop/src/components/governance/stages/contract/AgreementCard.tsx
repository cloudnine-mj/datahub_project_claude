// 계약 단계 최종 협의 내용 카드 — 협의 시점 값을 이어받아 표시하고, 계약 중 조정 시
//   인라인 편집 + 변경 이력 자동 기록. 협의 단계 AgreementResultCard 의 셀/다운로드를 재사용.
//
//   - 변경된 행: 배경 #FCF8EF + "수정됨" 뱃지 + 마지막 변경 시각·작성자.
//   - 헤더: "협의 완료" 뱃지 + (수정 1건↑) "계약 단계 N건 수정" 뱃지 + [다운로드 ▾] + 자동 저장.
//   - 변경 이력 펼침(기본 펼침, 1건↑일 때만): 최신 위, 시스템(최초 진입) 항목은 맨 아래 보존.

"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  CircleCheck,
  History,
  Pencil,
  Save,
} from "lucide-react";
import {
  formatAmount,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import {
  latestFor,
  nonSystemCount,
  sortedForDisplay,
  type ChangeLogEntry,
} from "@/lib/governance/agreement-change-log";
import {
  AgreementCell,
  DownloadMenu,
} from "../negotiation/AgreementResultCard";

interface FieldConfig {
  key: NegotiationField;
  label: string;
  format?: (v: string) => string;
  autoFilledHint?: string;
}

const FIELD_CONFIG: readonly FieldConfig[] = [
  { key: "selectedVendor", label: "선정 업체" },
  { key: "amount", label: "금액", format: formatAmount },
  { key: "period", label: "작업 기간" },
  { key: "workCount", label: "작업 건수" },
];

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

interface Props {
  value: NegotiationResult;
  onField: (key: NegotiationField, next: string) => void;
  onDownload: (format: "xlsx" | "pdf") => void;
}

export function AgreementCard({ value, onField, onDownload }: Props) {
  const log = value.changeLog;
  const editCount = nonSystemCount(log);

  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          최종 협의 내용
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{ background: "#E1F5EE", color: "#0F6E56" }}
        >
          <CircleCheck size={11} aria-hidden="true" /> 협의 완료
        </span>
        {editCount > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#FAEEDA", color: "#854F0B" }}
          >
            <Pencil size={11} aria-hidden="true" /> 계약 단계 {editCount}건 수정
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <DownloadMenu onDownload={onDownload} />
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Save size={12} aria-hidden="true" /> 자동 저장
          </span>
        </div>
      </header>
      <p className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        계약 중 조정이 필요하면 수정할 수 있습니다. 변경 시 자동으로 이력이 기록됩니다.
      </p>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
        <table className="w-full text-[12px]">
          <tbody>
            {FIELD_CONFIG.map((f, i) => {
              const last = latestFor(log, f.key);
              const changed = last !== null;
              return (
                <tr
                  key={f.key}
                  className={
                    i < FIELD_CONFIG.length - 1
                      ? "border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)]"
                      : ""
                  }
                  style={changed ? { background: "#FCF8EF" } : undefined}
                >
                  <td
                    className="w-[120px] px-3 py-[9px] align-middle text-gray-500 dark:text-gray-400"
                    style={{
                      background: changed
                        ? "#FCF8EF"
                        : "var(--color-background-secondary,#f9fafb)",
                    }}
                  >
                    {f.label}
                  </td>
                  <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <AgreementCell
                          value={value[f.key]}
                          canEdit
                          emptyEditable="+ 클릭해서 입력"
                          format={f.format}
                          onCommit={(next) => onField(f.key, next)}
                        />
                      </div>
                      {changed && last && (
                        <>
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                            style={{ background: "#FAEEDA", color: "#854F0B" }}
                          >
                            <Pencil size={9} aria-hidden="true" /> 수정됨
                          </span>
                          <span className="shrink-0 text-[10px] text-gray-400">
                            {fmtTime(last.timestamp)} · {last.actor}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {log.length > 0 && <ChangeLogPanel log={log} />}
    </section>
  );
}

/** 변경 이력 펼침 — 기본 펼침. 최신 위, 시스템 항목은 맨 아래. */
function ChangeLogPanel({ log }: { log: ChangeLogEntry[] }) {
  const [open, setOpen] = useState(true);
  const sorted = sortedForDisplay(log);

  return (
    <div
      className="mt-3 rounded-lg px-3 py-2.5"
      style={{ background: "var(--color-background-secondary,#f9fafb)" }}
    >
      <div className="flex items-center gap-1.5">
        <History size={13} aria-hidden="true" className="text-gray-500 dark:text-gray-400" />
        <span className="text-[12px] text-gray-600 dark:text-gray-300">변경 이력</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {open ? "접기" : "펼치기"}
          {open ? (
            <ChevronUp size={12} aria-hidden="true" />
          ) : (
            <ChevronDown size={12} aria-hidden="true" />
          )}
        </button>
      </div>

      {open && (
        <ul className="mt-2 flex flex-col gap-2">
          {sorted.map((e, i) => (
            <li key={`${e.timestamp}-${i}`} className="flex items-start gap-2 text-[11px]">
              <span className="w-[80px] shrink-0 text-gray-400">{fmtTime(e.timestamp)}</span>
              <span className="w-[60px] shrink-0 text-gray-500 dark:text-gray-400">
                {e.actor}
              </span>
              <span className="min-w-0 flex-1 text-gray-600 dark:text-gray-300">
                {e.field === "system" ? (
                  <span className="text-gray-500 dark:text-gray-400">{e.note}</span>
                ) : (
                  <>
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {e.fieldLabel}
                    </span>{" "}
                    <span className="text-[var(--color-text-tertiary,#9ca3af)] line-through">
                      {e.before ?? "—"}
                    </span>{" "}
                    <span aria-hidden="true">→</span>{" "}
                    <span style={{ color: "#854F0B" }}>{e.after ?? "—"}</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
