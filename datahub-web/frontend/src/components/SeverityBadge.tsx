// 정책 분류 뱃지 — 2단계 (필수/권장). 보안·승인 등은 tags 로 분류.
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
};

export function SeverityBadge({ severity }: { severity: Severity | string | null | undefined }) {
  if (!severity) return null;
  const s = STYLES[severity as Severity];
  // 옛 데이터(예: 'security', 'approval_required', 'reference') 호환 — 회색 fallback
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
];
