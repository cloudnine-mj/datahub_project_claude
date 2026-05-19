"use client";

import { MODALITY_COLORS } from "@/lib/catalog-types";

interface MetadataBadgeProps {
  type: "modality" | "data_card_tier" | "tags" | "readme";
  value: string;
}

export default function MetadataBadge({ type, value }: MetadataBadgeProps) {
  if (type === "readme") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        README
      </span>
    );
  }

  if (type === "modality") {
    const colorClass =
      MODALITY_COLORS[value] || "bg-gray-100 text-gray-800 border-gray-300";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${colorClass}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        {value}
      </span>
    );
  }

  if (type === "data_card_tier") {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border bg-red-50 text-red-700 border-red-300">
        {value}
      </span>
    );
  }

  // tags
  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded border bg-gray-100 text-gray-700 border-gray-300">
      {value}
    </span>
  );
}
