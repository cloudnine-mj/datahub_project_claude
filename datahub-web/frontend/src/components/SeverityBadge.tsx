// 정책 중요도 뱃지 — Step 2,3 의 '필수/권장/참고' 시각화.
import type { Severity } from "@/lib/api";

const STYLES: Record<Severity, { label: string; cls: string; dot: string }> = {
  required:    { label: "필수", cls: "bg-red-50 text-red-700 border-red-200",       dot: "bg-red-500" },
  recommended: { label: "권장", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  reference:   { label: "참고", cls: "bg-gray-50 text-gray-600 border-gray-200",    dot: "bg-gray-400" },
};

export function SeverityBadge({ severity }: { severity: Severity | null | undefined }) {
  if (!severity) return null;
  const s = STYLES[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "required", label: "필수" },
  { value: "recommended", label: "권장" },
  { value: "reference", label: "참고" },
];
