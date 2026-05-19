"use client";

import type { SearchParams, FilterOptions } from "@/lib/platform-client";
import { FILTER_LABELS } from "@/lib/catalog-types";

interface FilterBarProps {
  filters: SearchParams;
  filterOptions: FilterOptions;
  onChange: (key: keyof SearchParams, value: string) => void;
}

const FILTER_KEYS: {
  key: keyof SearchParams;
  optionsKey: keyof FilterOptions;
}[] = [
  { key: "modality", optionsKey: "modalities" },
  { key: "task", optionsKey: "tasks" },
  { key: "organization", optionsKey: "organizations" },
  { key: "data_card_tier", optionsKey: "data_card_tiers" },
];

export default function FilterBar({
  filters,
  filterOptions,
  onChange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-3 mt-4">
      {FILTER_KEYS.map(({ key, optionsKey }) => (
        <select
          key={key}
          value={filters[key] || ""}
          onChange={(e) => onChange(key, e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-700 outline-none focus:border-teal-500 cursor-pointer"
        >
          <option value="">{FILTER_LABELS[key]} &#9662;</option>
          {(filterOptions[optionsKey] || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
