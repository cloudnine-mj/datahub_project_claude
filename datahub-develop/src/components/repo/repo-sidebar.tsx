"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  FolderOpen,
  History,
  TableProperties,
  Settings,
  CircleDot,
  GitPullRequest,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RepoSidebarProps {
  group: string;
  repo: string;
}

export function RepoSidebar({ group, repo }: RepoSidebarProps) {
  const pathname = usePathname();
  const base = `/${group}/${repo}`;

  const navItems = [
    { title: "Overview", href: base, icon: LayoutGrid, exact: true },
    { title: "Data Browser", href: `${base}/browser`, icon: FolderOpen },
    { title: "Issues", href: `${base}/issues`, icon: CircleDot },
    { title: "Pull Requests", href: `${base}/pulls`, icon: GitPullRequest },
    { title: "Version History", href: `${base}/versions`, icon: History },
    { title: "Explorer", href: `${base}/explorer`, icon: TableProperties },
    { title: "Settings", href: `${base}/settings`, icon: Settings },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-dh-border bg-white py-3">
      <div className="space-y-0.5 px-3">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href, item.exact)
                ? "bg-bg-surface text-text-primary"
                : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.title}
          </Link>
        ))}
      </div>
    </nav>
  );
}
