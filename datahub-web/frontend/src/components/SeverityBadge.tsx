// 정책 분류 뱃지 — 사용자 여정 분석의 4단계 예시 그대로.
import type { Severity } from "@/lib/api";

const STYLES: Record<Severity, { label: string; cls: string; dot: string }> = {
  required: {
    label: "필수",
    cls: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  recommended: {
    label: "권장",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  security: {
    label: "보안",
    cls: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  approval_required: {
    label: "승인 필요",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
};

export function SeverityBadge({ severity }: { severity: Severity | string | null | undefined }) {
  if (!severity) return null;
  const s = STYLES[severity as Severity];
  // 옛 데이터(예: 'reference') 가 남아있어도 안전하게 fallback — 가벼운 회색 뱃지
  if (!s) {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
        {String(severity)}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "required", label: "필수" },
  { value: "recommended", label: "권장" },
  { value: "security", label: "보안" },
  { value: "approval_required", label: "승인 필요" },
];
