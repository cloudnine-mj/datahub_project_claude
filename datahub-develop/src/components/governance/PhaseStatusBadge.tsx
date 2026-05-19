// 단계 페이지 공용 상태 배지 — success/info/warning/danger/neutral 5 variant.
//   info 는 브랜드 빨강 (LG 톤). 폰트 weight 500.

export type PhaseStatusVariant = "success" | "info" | "warning" | "danger" | "neutral";

const VARIANT_CLASS: Record<PhaseStatusVariant, string> = {
  success: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  info: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  neutral: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
};

interface Props {
  variant: PhaseStatusVariant;
  children: React.ReactNode;
}

export function PhaseStatusBadge({ variant, children }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${VARIANT_CLASS[variant]}`}
    >
      {children}
    </span>
  );
}
