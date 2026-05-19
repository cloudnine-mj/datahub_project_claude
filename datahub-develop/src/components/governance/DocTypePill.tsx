// 문서 유형(가이드/공지) 작은 뱃지 — SeverityBadge 와 같은 룩.
import { DOC_TYPE_STYLES } from "@/lib/governance/forms/utils-bridge";

export function DocTypePill({ docType }: { docType: string }) {
  const s = DOC_TYPE_STYLES[docType] ?? {
    pill: "bg-gray-50 text-gray-700 border-gray-200",
    dot: "bg-gray-400",
  };
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded-full border px-1.5 py-0 text-[10px] font-semibold " +
        s.pill
      }
    >
      {docType}
    </span>
  );
}
