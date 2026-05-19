"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  GitCommitHorizontal,
  User,
  GitBranch,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  FileDiff,
  Plus,
  Minus,
  RefreshCw,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { CommitInfo, BranchInfo, DiffEntryInfo } from "@/lib/catalog-types";

const PAGE_SIZE = 20;

export default function VersionHistoryPage() {
  const { group, repo } = useParams<{ group: string; repo: string }>();

  const [branches, setBranches] = useState<string[]>(["main"]);
  const [selectedBranch, setSelectedBranch] = useState("main");
  const [branchOpen, setBranchOpen] = useState(false);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Diff panel state
  const [selectedCommit, setSelectedCommit] = useState<CommitInfo | null>(null);
  const [diffEntries, setDiffEntries] = useState<DiffEntryInfo[]>([]);
  const [diffLoading, setDiffLoading] = useState(false);

  // Fetch branches once on mount
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

  // Fetch commits when branch or page changes
  useEffect(() => {
    setLoading(true);
    setCommits([]);
    setSelectedCommit(null);
    setDiffEntries([]);
    const amount = PAGE_SIZE * (page + 1) + 1; // fetch one extra to detect hasMore
    fetch(
      `/api/catalog/lakefs/${group}/${repo}/commits?ref=${encodeURIComponent(selectedBranch)}&amount=${amount}`,
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: CommitInfo[]) => {
        setCommits(Array.isArray(data) ? data : []);
      })
      .catch(() => setCommits([]))
      .finally(() => setLoading(false));
  }, [repo, selectedBranch, page]);

  // When a commit is selected, fetch its diff vs parent
  const handleCommitClick = (commit: CommitInfo) => {
    if (selectedCommit?.id === commit.id) {
      setSelectedCommit(null);
      setDiffEntries([]);
      return;
    }
    setSelectedCommit(commit);
    setDiffEntries([]);
    if (commit.parents.length === 0) return;
    setDiffLoading(true);
    const parent = commit.parents[0];
    fetch(
      `/api/catalog/lakefs/${group}/${repo}/diff?from_ref=${encodeURIComponent(parent)}&to_ref=${encodeURIComponent(commit.id)}`,
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data: DiffEntryInfo[]) => {
        setDiffEntries(Array.isArray(data) ? data : []);
      })
      .catch(() => setDiffEntries([]))
      .finally(() => setDiffLoading(false));
  };

  const pageCommits = commits.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const hasMore = commits.length > (page + 1) * PAGE_SIZE;

  return (
    <div className="max-w-3xl space-y-4">
      {/* Sub Tabs */}
      <div className="flex gap-1 border-b border-dh-border">
        <Link
          href={`/${group}/${repo}/browser/main`}
          className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-text-secondary hover:text-text-primary"
        >
          Files
        </Link>
        <Link
          href={`/${group}/${repo}/versions`}
          className="px-4 py-2 text-sm font-medium border-b-2 border-brand text-brand"
        >
          Versions
        </Link>
      </div>

      {/* Branch selector */}
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setBranchOpen((o) => !o)}
          className="inline-flex items-center gap-2 rounded-md border border-dh-border bg-bg-surface px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-white transition-colors"
        >
          <GitBranch className="h-3.5 w-3.5 text-text-secondary" />
          <span>{selectedBranch}</span>
          <span className="text-xs text-text-muted">{commits.length} commits</span>
          <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
        </button>
        {branchOpen && branches.length > 0 && (
          <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-dh-border bg-white py-1 shadow-md">
            {branches.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => {
                  setBranchOpen(false);
                  setSelectedBranch(b);
                  setPage(0);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors hover:bg-bg-surface ${
                  b === selectedBranch ? "font-semibold text-brand" : "text-text-primary"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5 text-text-muted" />
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Commit list */}
      <div className="rounded-xl border border-dh-border overflow-hidden">
        <div className="bg-bg-surface px-4 py-2.5 border-b border-dh-border flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Commits — {selectedBranch}
          </span>
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-text-secondary">불러오는 중...</div>
        ) : pageCommits.length === 0 ? (
          <EmptyState
            icon={GitCommitHorizontal}
            title="커밋이 없습니다"
            description={`${selectedBranch} 브랜치에 커밋 이력이 없습니다.`}
          />
        ) : (
          <div className="divide-y divide-dh-border">
            {pageCommits.map((commit) => (
              <div key={commit.id}>
                {/* Commit row */}
                <button
                  type="button"
                  onClick={() => handleCommitClick(commit)}
                  className="w-full flex items-start gap-4 px-4 py-4 hover:bg-bg-surface transition-colors text-left"
                >
                  <GitCommitHorizontal className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{commit.message}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                      {commit.userEmail && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {commit.userEmail}
                        </span>
                      )}
                      <span>{formatDate(commit.date)}</span>
                      <code className="font-mono bg-bg-surface px-1.5 py-0.5 rounded text-text-secondary">
                        {commit.shortId}
                      </code>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
                      selectedCommit?.id === commit.id ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {/* Diff panel */}
                {selectedCommit?.id === commit.id && (
                  <div className="border-t border-dh-border bg-bg-surface">
                    {diffLoading ? (
                      <div className="flex items-center gap-2 px-6 py-4 text-sm text-text-muted">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        변경 내용 불러오는 중...
                      </div>
                    ) : commit.parents.length === 0 ? (
                      <p className="px-6 py-4 text-sm text-text-muted">최초 커밋입니다.</p>
                    ) : diffEntries.length === 0 ? (
                      <p className="px-6 py-4 text-sm text-text-muted">변경된 파일이 없습니다.</p>
                    ) : (
                      <div className="divide-y divide-dh-border">
                        <div className="px-6 py-2 text-xs font-medium text-text-secondary">
                          {diffEntries.length}개 파일 변경됨
                        </div>
                        {diffEntries.map((entry) => (
                          <div
                            key={entry.path}
                            className="flex items-center gap-3 px-6 py-2 text-sm"
                          >
                            {entry.change_type === "added" ? (
                              <Plus className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            ) : entry.change_type === "removed" ? (
                              <Minus className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            ) : (
                              <FileDiff className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            )}
                            <span
                              className={`flex-1 font-mono text-xs truncate ${
                                entry.change_type === "added"
                                  ? "text-emerald-700"
                                  : entry.change_type === "removed"
                                  ? "text-red-600 line-through"
                                  : "text-text-primary"
                              }`}
                            >
                              {entry.path}
                            </span>
                            {entry.size_bytes != null && (
                              <span className="text-xs text-text-muted shrink-0">
                                {(entry.size_bytes / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1.5 rounded-md border border-dh-border px-3 py-1.5 text-text-secondary hover:bg-bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            이전
          </button>
          <span className="text-text-muted">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, commits.length)}
          </span>
          <button
            type="button"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1.5 rounded-md border border-dh-border px-3 py-1.5 text-text-secondary hover:bg-bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            다음
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
