// 신청서 상태 뱃지 — 내 문서 목록·상세 화면 공용.
import type { FormStatus } from "@/lib/api";

const STYLES: Record<FormStatus, { label: string; cls: string; dot: string }> = {
  draft: {
    label: "임시저장",
    cls: "bg-gray-50 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
  },
  submitted: {
    label: "제출됨",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  reviewing: {
    label: "검토 중",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  approved: {
    label: "승인 완료",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  rejected: {
    label: "반려",
    cls: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

export function StatusBadge({ status }: { status: FormStatus | string }) {
  const s = STYLES[status as FormStatus] ?? STYLES.submitted;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export const STATUSES: { value: FormStatus; label: string }[] = [
  { value: "submitted", label: "제출됨" },
  { value: "reviewing", label: "검토 중" },
  { value: "approved", label: "승인 완료" },
  { value: "rejected", label: "반려" },
];
