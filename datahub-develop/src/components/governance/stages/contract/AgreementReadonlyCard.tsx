// 계약 단계 최종 협의 내용 카드 — 읽기 전용(잠김).
//
// 협의 단계에서 확정된 4필드를 그대로 표시. 계약 단계에서는 편집/변경이력 없음.
//   - 모든 셀 읽기 전용(클릭해도 input 전환 없음, Pencil 미노출). 빈 값은 "—".
//   - 헤더: "협의 완료 · 잠김" 뱃지(Lock) + [다운로드 ▾] (자동 저장 라벨 없음).
//   - 다운로드는 협의 단계의 negotiation-export 를 그대로 재사용(현재 값 출력).

"use client";

import { Lock } from "lucide-react";
import {
  formatAmount,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import {
  AgreementCell,
  DownloadMenu,
} from "../negotiation/AgreementResultCard";

interface FieldConfig {
  key: NegotiationField;
  label: string;
  format?: (v: string) => string;
}

const FIELD_CONFIG: readonly FieldConfig[] = [
  { key: "selectedVendor", label: "선정 업체" },
  { key: "amount", label: "금액", format: formatAmount },
  { key: "period", label: "작업 기간" },
  { key: "workCount", label: "작업 건수" },
];

interface Props {
  value: NegotiationResult;
  onDownload: (format: "xlsx" | "pdf") => void;
}

export function AgreementReadonlyCard({ value, onDownload }: Props) {
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          최종 협의 내용
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
          style={{
            background: "var(--color-background-secondary,#f3f4f6)",
            color: "var(--color-text-secondary,#6b7280)",
          }}
        >
          <Lock size={11} aria-hidden="true" /> 협의 완료 · 잠김
        </span>
        <div className="ml-auto">
          <DownloadMenu onDownload={onDownload} />
        </div>
      </header>

      <div className="mt-3 overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
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
                  <AgreementCell
                    value={value[f.key]}
                    canEdit={false}
                    emptyEditable=""
                    emptyReadonly="—"
                    format={f.format}
                    onCommit={() => {}}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary,#9ca3af)]">
        협의 단계에서 확정된 내용입니다. 계약 단계에서는 수정할 수 없습니다.
      </p>
    </section>
  );
}
