"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Brain, Folder, LayoutGrid, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// 화면 캡처의 좌측 사이드바 — Datasets / Models / Workspace / Dashboard / Governance
const NAV = [
  { href: "/datasets", label: "Datasets", icon: Database },
  { href: "/models", label: "Models", icon: Brain },
  { href: "/workspace", label: "Workspace", icon: Folder },
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/governance", label: "Governance", icon: ShieldCheck },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="text-base font-semibold tracking-tight">LG AI DataHub</span>
      </div>
      <nav className="px-3 py-2">
        {NAV.map((item) => {
          const active = pathname?.startsWith(item.href) ?? false;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                active ? "text-brand" : "text-gray-600 hover:bg-gray-50",
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
