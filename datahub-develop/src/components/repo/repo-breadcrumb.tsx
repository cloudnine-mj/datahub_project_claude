"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Database, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface RepoBreadcrumbProps {
  group: string;
  repo: string;
  repoType?: "dataset" | "model";
}

export function RepoBreadcrumb({ group, repo, repoType = "dataset" }: RepoBreadcrumbProps) {
  const pathname = usePathname();

  // Generate sub-path segments after /:group/:repo
  const base = `/${group}/${repo}`;
  const subPath = pathname.replace(base, "").split("/").filter(Boolean);

  const segmentMap: Record<string, string> = {
    browser: "Data Browser",
    versions: "Version History",
    explorer: "Explorer",
    settings: "Settings",
  };

  const Icon = repoType === "dataset" ? Database : Brain;
  const iconColor = repoType === "dataset" ? "text-brand" : "text-accent-blue";
  const iconBg = repoType === "dataset" ? "bg-red-50" : "bg-blue-50";

  return (
    <div className="flex items-center gap-1.5 border-b border-dh-border bg-white px-6 py-3">
      <div className={cn("flex h-5 w-5 items-center justify-center rounded", iconBg)}>
        <Icon className={cn("h-3 w-3", iconColor)} />
      </div>
      <Link href={`/${group}`} className="text-sm text-text-secondary hover:text-text-primary transition-colors">
        {group}
      </Link>
      <ChevronRight className="h-3 w-3 text-text-muted" />
      <Link href={`/${group}/${repo}`} className="text-sm font-medium text-text-primary hover:text-brand transition-colors">
        {repo}
      </Link>
      {subPath.map((segment, i) => (
        <span key={segment} className="flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3 text-text-muted" />
          <span className="text-sm text-text-secondary">
            {segmentMap[segment] ?? segment}
          </span>
        </span>
      ))}
    </div>
  );
}
