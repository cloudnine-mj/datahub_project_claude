"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Database, Brain, Folder, LayoutGrid, ShieldCheck } from "lucide-react";
import { api, type FormType, type Me } from "@/lib/api";
import { cn, FORM_TYPE_LABELS } from "@/lib/utils";

// 서식 모음 하위 노출용 — formSchemas 에 정의된 7종과 일치하는 순서로 노출
const FORM_TYPES_FOR_SIDEBAR: FormType[] = [
  "data_production",
  "data_purchase",
  "data_subscription",
  "product_log_usage",
  "data_production_plan",
  "api_usage_plan",
  "productivity_tool",
];

// 사이드바 — Datasets / Models / Workspace / Dashboard / Governance.
// Governance 는 세부 카테고리를 가지며, /governance 경로 진입 시 자동으로 펼쳐짐.
// '거버넌스 요청 관리' 자식은 admin role 사용자에게만 노출.

interface NavChild {
  href: string;
  label: string;
  adminOnly?: boolean;
  /** admin 일 때 라벨 오버라이드 — 같은 URL 이지만 admin 컨텍스트의 의미가 다른 페이지용 */
  adminLabel?: string;
  /** 2단계 하위 항목 — 부모가 펼쳐졌을 때 한 단계 더 들여쓰기로 노출 */
  subchildren?: { href: string; label: string }[];
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
      { href: "/governance/policy", label: "데이터 관리 정책" },
      { href: "/governance/process", label: "데이터 제작 / 활용 요청 프로세스" },
      {
        href: "/governance/forms",
        label: "데이터 거버넌스 문서 서식 모음",
        subchildren: FORM_TYPES_FOR_SIDEBAR.map((t) => ({
          href: `/governance/forms/${t}/new`,
          label: FORM_TYPE_LABELS[t] ?? t,
        })),
      },
      {
        href: "/governance/forms/my",
        label: "내 문서 목록",
        adminLabel: "정책 / 프로세스 게시글 관리",
      },
      { href: "/governance/forms/list", label: "거버넌스 요청 목록" },
      { href: "/governance/admin/forms", label: "거버넌스 요청 관리", adminOnly: true },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const [me, setMe] = useState<Me | null>(null);

  // 경로 전환마다 me 재조회 — Sidebar 가 루트 레이아웃에 있어 remount 가 없으므로
  // 로그인/로그아웃 후 단순 router.push 만으로는 role 변화가 반영되지 않음.
  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, [pathname]);

  // 다른 탭/창에서 localStorage 가 바뀐 경우 (mock 모드의 계정 전환) 동기화
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "datahub-user-email") {
        api.me().then(setMe).catch(() => setMe(null));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
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
                        {c.subchildren && c.subchildren.length > 0 && (
                          <ul className="ml-2 mt-0.5 mb-1 border-l border-gray-100 pl-3">
                            {c.subchildren.map((sc) => {
                              const subActive =
                                pathname === sc.href || pathname.startsWith(sc.href + "/");
                              return (
                                <li key={sc.href}>
                                  <Link
                                    href={sc.href}
                                    className={cn(
                                      "block rounded-md px-3 py-1 text-[11px] transition",
                                      subActive
                                        ? "font-semibold text-brand"
                                        : "text-gray-400 hover:bg-gray-50 hover:text-gray-700",
                                    )}
                                  >
                                    {sc.label}
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        )}
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
