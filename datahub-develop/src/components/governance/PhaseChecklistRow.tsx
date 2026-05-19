// 단계 페이지 공용 체크리스트 row — 체크박스 + 라벨(+선택 설명) + 우측 trailing.
//   onToggle 이 없으면 disabled (읽기 전용). 라벨 클릭으로도 토글 가능 (label htmlFor).

"use client";

interface Props {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  /** 미제공 시 disabled / 읽기 전용. */
  onToggle?: () => void;
  /** 우측에 노출할 액션 (예: '작성' 버튼). */
  trailing?: React.ReactNode;
}

export function PhaseChecklistRow({
  id,
  label,
  description,
  checked,
  onToggle,
  trailing,
}: Props) {
  const disabled = !onToggle;
  const interactive = !disabled;

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-2.5 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800/40 ${
        interactive
          ? "cursor-pointer transition hover:bg-gray-100 dark:hover:bg-gray-800"
          : ""
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={() => onToggle?.()}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        className="h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand focus:ring-brand disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] ${
            disabled
              ? "text-gray-500 dark:text-gray-400"
              : "text-gray-800 dark:text-gray-200"
          }`}
        >
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </label>
  );
}
