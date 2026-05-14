// 사이드바 최상위 메뉴 — Dashboard / Governance.
//   현재 경로 prefix 매치로 active 표시. governance 트리 펼침은 부모(Sidebar)에서 관리.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, ShieldCheck } from "lucide-react";
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
  { id: "dashboard", label: "Dashboard", path: "/dashboard", icon: LayoutGrid },
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
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-[#185FA5]/40 ${
                active
                  ? "bg-[#E6F1FB] font-medium text-[#185FA5] dark:bg-blue-900/30 dark:text-blue-300"
                  : "font-normal text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-gray-100"
              }`}
            >
              <Icon
                size={16}
                className={
                  active
                    ? "text-[#185FA5] dark:text-blue-300"
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
