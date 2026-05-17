// 대시보드 상단 '빠른 시작' 타일 6개 — 자주 쓰는 진입점 단축.
//   모바일 2열 / 태블릿 3열 / 데스크톱 6열. 폰트 weight 400/500.

"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Code,
  Database,
  FileText,
  ListFilter,
  Wrench,
} from "lucide-react";

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
  { id: "api", label: "API 활용", icon: Code, path: "/governance/forms/api_usage_plan/new" },
  {
    id: "productivity",
    label: "업무생산성",
    icon: Wrench,
    path: "/governance/forms/productivity_tool/new",
  },
  { id: "requests", label: "요청 조회", icon: ListFilter, path: "/governance/forms/list" },
  { id: "guide", label: "가이드", icon: BookOpen, path: "/governance/guideline" },
];

export function QuickStartTiles() {
  return (
    <div>
      <p className="mb-2 text-[12px] text-gray-400 dark:text-gray-500">빠른 시작</p>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.id}
              href={t.path}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2 py-3.5 text-center transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
            >
              <Icon
                size={20}
                aria-hidden="true"
                className="text-gray-700 dark:text-gray-200"
              />
              <span className="text-[11px] text-gray-800 dark:text-gray-200">
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
