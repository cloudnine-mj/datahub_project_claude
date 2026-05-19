"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { mainNavItems } from "./nav-items";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarProps {
  // context-specific nav items will be passed in for repo/group pages
  contextItems?: Array<{ title: string; href: string; icon: React.ComponentType<{ className?: string }> }>;
}

export function Sidebar({ contextItems }: SidebarProps) {
  const pathname = usePathname();
  const items = contextItems ?? mainNavItems;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-dh-border bg-white">
      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-0.5 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-bg-surface text-text-primary"
                  : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          ))}
        </nav>
      </ScrollArea>
    </div>
  );
}
