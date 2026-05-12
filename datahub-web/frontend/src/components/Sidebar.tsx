"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Database, Brain, Folder, LayoutGrid, ShieldCheck } from "lucide-react";
import { api, type Me } from "@/lib/api";
import { cn } from "@/lib/utils";

// 사이드바 — Datasets / Models / Workspace / Dashboard / Governance.
// Governance 는 세부 카테고리를 가지며, /governance 경로 진입 시 자동으로 펼쳐짐.
// '거버넌스 요청 관리' 자식은 admin role 사용자에게만 노출.

interface NavChild {
  href: string;
  label: string;
  adminOnly?: boolean;
  /** admin 일 때 라벨 오버라이드 — 같은 URL 이지만 admin 컨텍스트의 의미가 다른 페이지용 */
  adminLabel?: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Database;
  children?: NavChild[];
}

const NAV: NavItem[] = [
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/models", label: "Models", icon: Brain },
  { href: "/workspace", label: "Workspace", icon: Folder },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  {
    href: "/governance",
    label: "Governance",
    icon: ShieldCheck,
    children: [
      { href: "/governance/info", label: "정책 / 프로세스 자료실" },
      { href: "/governance/forms", label: "데이터 거버넌스 문서 서식 모음" },
      {
        href: "/governance/forms/my",
        label: "내 문서 목록",
        adminLabel: "정책 / 프로세스 게시글 관리",
      },
      { href: "/governance/admin/forms", label: "거버넌스 요청 관리", adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  const isAdmin = me?.user.role === "admin";

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="text-base font-semibold tracking-tight">LG AI DataHub</span>
      </div>
      <nav className="px-3 py-2">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          // 부모가 active 거나 자식 중 하나가 active 면 자식 메뉴 펼침
          const expanded = active && !!item.children;
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                  active ? "text-brand" : "text-gray-600 hover:bg-gray-50",
                )}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
              {expanded && item.children && (() => {
                // adminOnly child 는 admin 에게만 노출
                const visibleChildren = item.children.filter((c) => !c.adminOnly || isAdmin);
                // 가장 긴 prefix 매치 child 만 active 표시
                // (예: /governance/forms/my 는 /governance/forms 가 아니라 /governance/forms/my 만 active)
                const activeChildHref = [...visibleChildren]
                  .sort((a, b) => b.href.length - a.href.length)
                  .find((c) => pathname === c.href || pathname.startsWith(c.href + "/"))?.href;
                return (
                <ul className="ml-3 mt-0.5 mb-1 border-l border-gray-100 pl-3">
                  {visibleChildren.map((c) => {
                    const childActive = c.href === activeChildHref;
                    return (
                      <li key={c.href}>
                        <Link
                          href={c.href}
                          className={cn(
                            "block rounded-md px-3 py-1.5 text-xs transition",
                            childActive
                              ? "font-semibold text-brand"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
                          )}
                        >
                          {isAdmin && c.adminLabel ? c.adminLabel : c.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                );
              })()}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
