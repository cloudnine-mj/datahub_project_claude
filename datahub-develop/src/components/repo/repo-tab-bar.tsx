"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface RepoTabBarProps {
  group: string;
  repo: string;
}

const TABS = [
  {
    label: "Overview",
    match: (pathname: string, base: string) => pathname === base,
    href: (base: string) => base,
  },
  {
    label: "Files & Versions",
    match: (pathname: string, base: string) =>
      pathname.startsWith(`${base}/browser`) || pathname.startsWith(`${base}/versions`),
    href: (base: string) => `${base}/browser/main`,
  },
  {
    label: "Community",
    match: (pathname: string, base: string) => pathname.startsWith(`${base}/issues`),
    href: (base: string) => `${base}/issues`,
  },
  {
    label: "Settings",
    match: (pathname: string, base: string) => pathname.startsWith(`${base}/settings`),
    href: (base: string) => `${base}/settings`,
  },
];

export function RepoTabBar({ group, repo }: RepoTabBarProps) {
  const pathname = usePathname();
  const base = `/${group}/${repo}`;

  return (
    <div className="border-b border-dh-border bg-white px-6">
      <nav className="-mb-px flex gap-0">
        {TABS.map(({ label, match, href }) => {
          const isActive = match(pathname, base);
          return (
            <Link
              key={label}
              href={href(base)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? "border-brand text-brand"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:border-dh-border"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
