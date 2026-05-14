// 대시보드 상단 '빠른 시작' 타일 4개 — 자주 쓰는 신청서 진입 단축.
//   2열(mobile) / 4열(sm 이상) grid. 폰트 weight 400/500.

"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Code, Database, FileText, Wrench } from "lucide-react";

interface Tile {
  id: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

const TILES: Tile[] = [
  { id: "data", label: "데이터 신청", icon: Database, path: "/governance/forms/intake" },
  {
    id: "product-log",
    label: "Product 로그",
    icon: FileText,
    path: "/governance/forms/product_log_usage/new",
  },
  {
    id: "api",
    label: "API 활용",
    icon: Code,
    path: "/governance/forms/api_usage_plan/new",
  },
  {
    id: "productivity",
    label: "업무생산성",
    icon: Wrench,
    path: "/governance/forms/productivity_tool/new",
  },
];

export function QuickStartTiles() {
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-gray-400 dark:text-gray-500">빠른 시작</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={t.path}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-center transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
            >
              <Icon
                size={18}
                aria-hidden="true"
                className="text-gray-600 dark:text-gray-300"
              />
              <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200">
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
