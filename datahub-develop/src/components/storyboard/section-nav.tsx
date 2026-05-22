"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionNavItem {
  title: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  group?: string;
}

interface SectionNavProps {
  items: SectionNavItem[];
  className?: string;
}

export function SectionNav({ items, className }: SectionNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 같은 pathname 을 query 로만 구분하는 메뉴(예: /governance/process vs
  // /governance/process?manage=1) 가 있어 href 의 query 도 함께 비교해야 함.
  const isActive = (href: string) => {
    const [hrefPath, hrefQuery = ""] = href.split("?");
    const pathMatches =
      pathname === hrefPath ||
      (hrefPath !== "/" && pathname.startsWith(hrefPath + "/"));
    if (!pathMatches) return false;

    if (!hrefQuery) {
      // href 에 query 가 없는 경우 — 현재 URL 에 동일 pathname 을 가진 query 메뉴
      // (예: ?manage=1) 가 있으면 본 메뉴는 비활성. 같은 pathname 의 query 메뉴 중
      // 어느 것도 매칭 안 될 때만 활성화.
      const others = items.filter(
        (it) => it.href !== href && it.href.split("?")[0] === hrefPath,
      );
      const anyOtherMatches = others.some((it) => {
        const otherQs = it.href.split("?")[1] ?? "";
        if (!otherQs) return false;
        let allMatch = true;
        new URLSearchParams(otherQs).forEach((v, k) => {
          if (searchParams?.get(k) !== v) allMatch = false;
        });
        return allMatch;
      });
      return !anyOtherMatches;
    }

    // href 에 query 가 있으면 그 모든 key/value 가 현재 URL 의 query 와 일치해야 함.
    let allMatch = true;
    new URLSearchParams(hrefQuery).forEach((v, k) => {
      if (searchParams?.get(k) !== v) allMatch = false;
    });
    return allMatch;
  };

  const groups = items.reduce<Record<string, SectionNavItem[]>>((acc, item) => {
    const key = item.group ?? "_";
    acc[key] = acc[key] ?? [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <aside className={cn("w-full lg:w-56 shrink-0", className)}>
      <nav className="flex flex-col gap-6">
        {Object.entries(groups).map(([group, list]) => (
          <div key={group} className="flex flex-col gap-1">
            {group !== "_" && (
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {group}
              </div>
            )}
            {list.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-bg-surface text-text-primary font-medium"
                      : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
                  )}
                >
                  {Icon && (
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        active ? "text-brand" : "text-text-muted"
                      )}
                    />
                  )}
                  <span className="flex-1 truncate">{item.title}</span>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        active
                          ? "bg-brand/10 text-brand"
                          : "bg-bg-surface text-text-muted group-hover:bg-white"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
