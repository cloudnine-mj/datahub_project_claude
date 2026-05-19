// 사이드바 최상위 메뉴 — Datahub 전 영역 진입점.
//   현재 경로 prefix 매치로 active 표시. governance 트리 펼침은 부모(Sidebar)에서 관리.
//   Governance 외 항목은 아직 미구현 — coming-soon 페이지로 안내.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Box,
  Building2,
  Database,
  FolderKanban,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TopItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** prefix 매치할 경로 (path 와 다를 수 있음) — 보통은 path 와 동일. */
  matchPrefix?: string;
}

const TOP_ITEMS: TopItem[] = [
  { id: "models", label: "Models", path: "/coming-soon?from=models", icon: Box, matchPrefix: "/models" },
  {
    id: "datasets",
    label: "Datasets",
    path: "/coming-soon?from=datasets",
    icon: Database,
    matchPrefix: "/datasets",
  },
  {
    id: "projects",
    label: "Projects",
    path: "/coming-soon?from=projects",
    icon: FolderKanban,
    matchPrefix: "/projects",
  },
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutGrid },
  {
    id: "analytics",
    label: "Analytics",
    path: "/coming-soon?from=analytics",
    icon: BarChart3,
    matchPrefix: "/analytics",
  },
  {
    id: "organizations",
    label: "Organizations",
    path: "/coming-soon?from=organizations",
    icon: Building2,
    matchPrefix: "/organizations",
  },
  { id: "governance", label: "Governance", path: "/governance", icon: ShieldCheck },
];

export function TopLevelMenu() {
  const pathname = usePathname() ?? "";
  return (
    <ul className="flex flex-col gap-0.5">
      {TOP_ITEMS.map((item) => {
        const prefix = item.matchPrefix ?? item.path;
        const active = pathname === prefix || pathname.startsWith(prefix + "/");
        const Icon = item.icon;
        return (
          <li key={item.id}>
            <Link
              href={item.path}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand/40 ${
                active
                  ? "bg-red-50 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300"
                  : "font-normal text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
              }`}
            >
              <Icon
                size={16}
                className={
                  active
                    ? "text-brand dark:text-red-300"
                    : "text-gray-500 dark:text-gray-400"
                }
              />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export const TOP_LEVEL_GOVERNANCE_PREFIX = "/governance";
