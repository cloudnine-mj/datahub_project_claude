// 계약 정보 (EAS) 카드 — 협의·계약 통합 단계 안에 포함. 품의번호 1행(인라인 편집).
//   품의번호 1개 고정(필드 증감 금지). 저장은 부모가 contract-storage 로 영속.

"use client";

import { Save } from "lucide-react";
import { InlineCell } from "./InlineCell";

interface Props {
  value: string;
  onCommit: (next: string) => void;
}

export function EasInfoCard({ value, onCommit }: Props) {
  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          계약 정보 (EAS)
        </h3>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-gray-400">
          <Save size={12} aria-hidden="true" /> 자동 저장 (담당자만)
        </span>
      </header>
      <p className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
        EAS에서 계약을 진행한 뒤 발급된 품의번호를 입력해 주세요.
      </p>

      <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
        <table className="w-full text-[12px]">
          <tbody>
            <tr>
              <td className="w-[120px] bg-[var(--color-background-secondary,#f9fafb)] px-3 py-[9px] align-middle text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                품의번호
              </td>
              <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
                <InlineCell
                  value={value}
                  emptyEditable="+ 클릭해서 입력"
                  onCommit={onCommit}
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
