// 최종 협의 내용 카드 — 협의·계약 통합 단계.
//   - 진행 중: 4필드 인라인 편집 + 카드 우하단에 [협의 완료] 버튼(4필드 다 입력 시 활성).
//   - 잠금: readOnly + 카드 자동 접힘 + 헤더에 '협의 완료 (잠금)' 뱃지·[펼쳐 보기] 토글.

"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Lock, Save } from "lucide-react";
import {
  emptyFields,
  formatAmount,
  type NegotiationField,
  type NegotiationResult,
} from "@/lib/governance/negotiation-storage";
import { InlineCell } from "./InlineCell";
import { CompleteButton } from "./CompleteButton";

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
  /** 협의 완료 여부 — true 면 잠금(readOnly + 자동 접힘 + 뱃지 변경). */
  isCompleted: boolean;
  /** [협의 완료] 클릭 — 부모가 sessionStorage 갱신 + 이력 기록. */
  onComplete: () => void;
}

export function AgreementCard({ value, onField, isCompleted, onComplete }: Props) {
  // 잠금 상태가 되면 자동 접힘. 그 전엔 항상 펼쳐 있음.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (isCompleted) setCollapsed(true);
  }, [isCompleted]);

  const allFilled = emptyFields(value).length === 0;
  const canEdit = !isCompleted;

  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          최종 협의 내용
        </h3>
        {isCompleted ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <Lock size={11} aria-hidden="true" /> 협의 완료
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#FAEEDA", color: "#854F0B" }}
          >
            협의 진행 중
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {!isCompleted && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
              <Save size={12} aria-hidden="true" /> 자동 저장 (담당자만)
            </span>
          )}
          {isCompleted && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
              className="inline-flex items-center gap-1 text-[11px] text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {collapsed ? "펼쳐 보기" : "접기"}
              <ChevronDown
                size={13}
                aria-hidden="true"
                className={`transition-transform ${collapsed ? "" : "rotate-180"}`}
              />
            </button>
          )}
        </div>
      </header>

      {!isCompleted && (
        <p className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
          최종 협의된 내용을 작성합니다. 담당자가 직접 입력합니다.
        </p>
      )}

      {!collapsed && (
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
                          canEdit={canEdit}
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
      )}

      {!isCompleted && (
        <CompleteButton
          label="협의 완료"
          isEnabled={allFilled}
          helperText="4필드 모두 입력 시 활성"
          onClick={onComplete}
        />
      )}
    </section>
  );
}
