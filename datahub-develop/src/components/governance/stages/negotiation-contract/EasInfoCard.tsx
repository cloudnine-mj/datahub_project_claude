// 계약 정보 (EAS) 카드 — 협의 완료 → 활성 → 품의번호 입력 → [계약 완료] → 잠금.
//   - 협의 완료 전: opacity 0.55 + Lock 뱃지 '협의 완료 후 활성' + 입력 비활성.
//   - 활성: 강조 테두리 + '계약 진행 중' 뱃지 + 인라인 입력 + [계약 완료] 버튼.
//   - 잠금: readOnly + 자동 접힘 + '계약 완료 (잠금)' 뱃지.

"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Lock, Save } from "lucide-react";
import { InlineCell } from "./InlineCell";
import { CompleteButton } from "./CompleteButton";

interface Props {
  value: string;
  onCommit: (next: string) => void;
  /** 협의 단계가 완료됐는지 — false 면 카드 자체가 비활성(Lock). */
  negotiationCompleted: boolean;
  /** 계약 완료 여부 — true 면 readOnly + 자동 접힘. */
  isCompleted: boolean;
  /** [계약 완료] 클릭. */
  onComplete: () => void;
}

export function EasInfoCard({
  value,
  onCommit,
  negotiationCompleted,
  isCompleted,
  onComplete,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (isCompleted) setCollapsed(true);
  }, [isCompleted]);

  const canEdit = negotiationCompleted && !isCompleted;
  const filled = value.trim().length > 0;

  // 카드 외곽 스타일 — 비활성/활성/완료 분기.
  const sectionStyle: React.CSSProperties = isCompleted
    ? {}
    : negotiationCompleted
      ? { borderColor: "#EFC4B9" }
      : { opacity: 0.55 };
  const sectionCls = isCompleted
    ? "rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
    : "rounded-xl border-[0.5px] bg-white p-5 dark:bg-gray-900";

  return (
    <section className={sectionCls} style={sectionStyle}>
      <header className="mb-1 flex items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          계약 정보 (EAS)
        </h3>
        {isCompleted ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#E1F5EE", color: "#0F6E56" }}
          >
            <Lock size={11} aria-hidden="true" /> 계약 완료
          </span>
        ) : negotiationCompleted ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: "#FAEEDA", color: "#854F0B" }}
          >
            계약 진행 중
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: "var(--color-background-secondary,#f3f4f6)",
              color: "var(--color-text-tertiary,#9ca3af)",
            }}
          >
            <Lock size={11} aria-hidden="true" /> 협의 완료 후 활성
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
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
          EAS에서 계약을 진행한 뒤 발급된 품의번호를 입력해 주세요.
        </p>
      )}

      {!collapsed && (
        <div className="overflow-hidden rounded-lg border border-[var(--color-border-primary,#e5e7eb)]">
          <table className="w-full text-[12px]">
            <tbody>
              <tr>
                <td className="w-[90px] bg-[var(--color-background-secondary,#f9fafb)] px-3 py-[9px] align-middle text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
                  품의번호
                </td>
                <td className="px-3 py-[9px] align-middle text-gray-900 dark:text-gray-100">
                  <InlineCell
                    value={value}
                    canEdit={canEdit}
                    emptyReadonly={
                      negotiationCompleted ? "—" : "[협의 완료] 후 입력 가능"
                    }
                    onCommit={onCommit}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 활성 상태에서만 [계약 완료] 버튼 노출. 협의 완료 전엔 아예 안 보임. */}
      {negotiationCompleted && !isCompleted && (
        <CompleteButton
          label="계약 완료"
          isEnabled={filled}
          helperText="품의번호 입력 시 활성"
          onClick={onComplete}
        />
      )}
    </section>
  );
}
