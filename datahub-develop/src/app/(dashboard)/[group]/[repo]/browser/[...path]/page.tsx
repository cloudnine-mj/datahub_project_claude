"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Folder,
  FileText,
  Upload,
  GitBranch,
  ChevronDown,
  ChevronRight,
  GitCommitHorizontal,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/catalog-types";
import type { FileTreeNode, BranchInfo } from "@/lib/catalog-types";
import { formatDate } from "@/lib/utils";

const FILE_ICONS: Record<string, string> = {
  parquet: "🟦",
  csv: "📊",
  json: "📋",
  md: "📝",
  txt: "📄",
  png: "🖼️",
  jpg: "🖼️",
  jpeg: "🖼️",
  pdf: "📕",
  py: "🐍",
  sh: "⚙️",
};

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

type SubTab = "files" | "versions";

export default function DataBrowserPage() {
  const { group, repo, path: rawPath } = useParams<{
    group: string;
    repo: string;
    path: string[];
  }>();
  const router = useRouter();

  const pathSegments: string[] = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const branch = pathSegments[0] ?? "main";
  const currentPath = pathSegments.slice(1).join("/");
  const base = `/${group}/${repo}/browser`;

  const [branches, setBranches] = useState<string[]>([]);
  const [branchOpen, setBranchOpen] = useState(false);
  const [entries, setEntries] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commitCount, setCommitCount] = useState<number | null>(null);

  // Fetch branches
  useEffect(() => {
    fetch(`/api/catalog/lakefs/${group}/${repo}/branches`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: BranchInfo[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setBranches(data.map((b) => b.id));
        }
      })
      .catch(() => {});
  }, [repo]);

  // Fetch commit count for the branch
  useEffect(() => {
    fetch(`/api/catalog/lakefs/${group}/${repo}/commits?ref=${encodeURIComponent(branch)}&amount=1`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown[]) => {
        if (Array.isArray(data)) setCommitCount(data.length);
      })
      .catch(() => {});
  }, [repo, branch]);

  // Fetch file tree
  const fetchFiles = useCallback(() => {
    setLoading(true);
    setError(null);
    const prefix = currentPath ? `${currentPath}/` : "";
    fetch(
      `/api/catalog/lakefs/${group}/${repo}/files?ref=${encodeURIComponent(branch)}&prefix=${encodeURIComponent(prefix)}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: FileTreeNode[]) => {
        setEntries(Array.isArray(data) ? data : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [repo, branch, currentPath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleBranchSelect = (b: string) => {
    setBranchOpen(false);
    router.push(`${base}/${b}`);
  };

  const parentPath = currentPath
    ? currentPath.includes("/")
      ? currentPath.split("/").slice(0, -1).join("/")
      : ""
    : null;

  return (
    <div className="max-w-4xl space-y-4">
      {/* Sub Tabs */}
      <div className="flex gap-1 border-b border-dh-border">
        <Link
          href={`${base}/${branch}`}
          className="px-4 py-2 text-sm font-medium border-b-2 border-brand text-brand"
        >
          Files
        </Link>
        <Link
          href={`/${group}/${repo}/versions`}
          className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-text-secondary hover:text-text-primary"
        >
          Versions
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        {/* Branch selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setBranchOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-md border border-dh-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-white transition-colors"
          >
            <GitBranch className="h-3.5 w-3.5 text-text-secondary" />
            <span>{branch}</span>
            {commitCount !== null && (
              <span className="text-xs text-text-muted">
                {commitCount} commit{commitCount !== 1 ? "s" : ""}
              </span>
            )}
            <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>
          {branchOpen && branches.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-dh-border bg-white py-1 shadow-md">
              {branches.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleBranchSelect(b)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-bg-surface ${
                    b === branch ? "font-semibold text-brand" : "text-text-primary"
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5 text-text-muted" />
                  {b}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Path breadcrumb */}
        {currentPath && (
          <div className="flex items-center gap-1 text-sm text-text-secondary flex-1 min-w-0">
            <Link href={`${base}/${branch}`} className="hover:text-text-primary truncate">
              {repo}
            </Link>
            {currentPath.split("/").map((seg, i, arr) => {
              const href = `${base}/${branch}/${arr.slice(0, i + 1).join("/")}`;
              return (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  {i === arr.length - 1 ? (
                    <span className="font-medium text-text-primary truncate">{seg}</span>
                  ) : (
                    <Link href={href} className="hover:text-text-primary truncate">{seg}</Link>
                  )}
                </span>
              );
            })}
          </div>
        )}

        <Button
          asChild
          size="sm"
          className="bg-brand hover:bg-brand/90 text-white gap-1.5 shrink-0"
        >
          <Link href={`/${group}/${repo}/upload`}>
            <Upload className="h-3.5 w-3.5" />
            Upload
          </Link>
        </Button>
      </div>

      {/* File Table */}
      <div className="rounded-xl border border-dh-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-dh-border bg-bg-surface">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Name</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-secondary w-24">Size</th>
              <th className="px-4 py-2.5 text-right font-medium text-text-secondary w-36">
                Last Modified
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dh-border">
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-text-muted">
                  불러오는 중...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-red-600">
                  {error}
                </td>
              </tr>
            ) : (
              <>
                {/* Parent dir link */}
                {parentPath !== null && (
                  <tr className="hover:bg-bg-surface">
                    <td className="px-4 py-3">
                      <Link
                        href={
                          parentPath
                            ? `${base}/${branch}/${parentPath}`
                            : `${base}/${branch}`
                        }
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary"
                      >
                        <Folder className="h-4 w-4 text-accent-orange" />
                        ..
                      </Link>
                    </td>
                    <td />
                    <td />
                  </tr>
                )}
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-text-muted">
                      이 경로에 파일이 없습니다
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const isDir = entry.type === "directory";
                    const href = isDir
                      ? `${base}/${branch}/${entry.path.replace(/\/$/, "")}`
                      : `/${group}/${repo}/blob/${branch}/${entry.path}`;
                    const ext = isDir ? "" : getExt(entry.name);
                    const icon = FILE_ICONS[ext];
                    return (
                      <tr key={entry.path} className="hover:bg-bg-surface transition-colors">
                        <td className="px-4 py-3">
                          <Link
                            href={href}
                            className="flex items-center gap-2 font-medium text-text-primary hover:text-accent-blue"
                          >
                            {isDir ? (
                              <Folder className="h-4 w-4 shrink-0 text-accent-orange" />
                            ) : icon ? (
                              <span className="text-base leading-none w-4 text-center shrink-0">
                                {icon}
                              </span>
                            ) : (
                              <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                            )}
                            {entry.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-text-muted">
                          {entry.size != null ? formatBytes(entry.size) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-text-muted">
                          —
                        </td>
                      </tr>
                    );
                  })
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
