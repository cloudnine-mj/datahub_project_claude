// 신청 유형 3-탭 선택기 — 구매 / 구독 / 용역 제작.
//   선택된 탭은 브랜드 빨강 배경 + 텍스트. 폰트 weight 400/500 만.

"use client";

import { RefreshCw, ShoppingCart, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PlanningType } from "@/lib/planningConfig";

interface Option {
  id: PlanningType;
  label: string;
  icon: LucideIcon;
}

const OPTIONS: Option[] = [
  { id: "purchase", label: "데이터 구매", icon: ShoppingCart },
  { id: "subscribe", label: "데이터 구독", icon: RefreshCw },
  { id: "service", label: "용역 제작", icon: Wrench },
];

interface Props {
  value: PlanningType;
  onChange: (next: PlanningType) => void;
}

export function TypeSelector({ value, onChange }: Props) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
        신청 유형을 선택하면 유형별 확인 사항이 표시됩니다.
      </p>
      <div role="tablist" className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(opt.id)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2.5 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand/40 ${
                active
                  ? "border-red-200 bg-red-50 font-medium text-red-700 dark:border-red-900/40 dark:bg-red-900/30 dark:text-red-300"
                  : "border-gray-200 bg-white font-normal text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              }`}
            >
              <Icon size={14} aria-hidden="true" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
