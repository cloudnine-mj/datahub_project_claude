// 최종 협의 내용 카드 — 협의·계약 통합 단계. 담당자가 협의 내용을 4필드로 정리(인라인 편집).
//   다운로드 기능 없음. 4필드 고정(증감 금지). 저장은 부모가 negotiation-storage 로 영속.

"use client";

import { Save } from "lucide-react";
import {
  formatAmount,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import { InlineCell } from "./InlineCell";

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
  { key: "workCount", label: "작업 건수", autoFilledHint: "신청서 자동 채움" },
];

interface Props {
  value: NegotiationResult;
  onField: (key: NegotiationField, next: string) => void;
}

export function AgreementCard({ value, onField }: Props) {
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          최종 협의 내용
        </h3>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400">
          <Save size={12} aria-hidden="true" /> 자동 저장 (담당자만)
        </span>
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
                <td className="w-[90px] bg-[var(--color-background-secondary,#f9fafb)] px-3 py-[9px] align-middle text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  {f.label}
                </td>
                <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <InlineCell
                        value={value[f.key]}
                        emptyEditable="+ 클릭해서 입력"
                        format={f.format}
                        onCommit={(next) => onField(f.key, next)}
                      />
                    </div>
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
    </section>
  );
}
