// 정책 분류 뱃지 — 4단계 (Low / Medium / High / Critical).
import type { Severity } from "@/lib/governance/api-client-full";

const STYLES: Record<Severity, { label: string; cls: string }> = {
  low: {
    label: "Low",
    cls: "bg-gray-50 text-gray-700 border-gray-200",
  },
  medium: {
    label: "Medium",
    cls: "bg-blue-50 text-blue-700 border-blue-200",
  },
  high: {
    label: "High",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  critical: {
    label: "Critical",
    cls: "bg-red-50 text-red-700 border-red-200",
  },
};

export function SeverityBadge({
  severity,
  size = "md",
}: {
  severity: Severity | string | null | undefined;
  size?: "sm" | "md";
}) {
  if (!severity) return null;
  const sizeCls =
    size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs";
  const s = STYLES[severity as Severity];
  // 옛 데이터(예: 'required', 'recommended', 'security') 호환 — 회색 fallback
  if (!s) {
    return (
      <span
        className={`inline-flex items-center whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 font-semibold text-gray-600 ${sizeCls}`}
      >
        {String(severity)}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border font-semibold ${sizeCls} ${s.cls}`}
    >
      {s.label}
    </span>
  );
}

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];
