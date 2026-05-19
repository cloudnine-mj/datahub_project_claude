"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Database,
  Plus,
  Search,
  Clock,
  ChevronRight,
  Users,
  GitCommitHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisibilityBadge } from "@/components/repo/VisibilityBadge";

interface LastCommitInfo {
  hash: string;
  message: string;
  author: string;
  created_at: number;
}

interface RepoInfo {
  repo_name: string;
  owner: string;
  role: string;
  visibility: string;
  description?: string | null;
  repo_type?: "A" | "B" | null;
  member_count?: number;
  last_commit?: LastCommitInfo | null;
  created_at: string;
}

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-blue-50 text-blue-700",
  maintainer: "bg-orange-50 text-orange-700",
  developer: "bg-green-50 text-green-700",
  guest: "bg-gray-50 text-gray-600",
};

const TYPE_LABEL: Record<string, string> = {
  A: "Dataset",
  B: "Model",
};

type TypeFilter = "all" | "A" | "B";

export default function DatasetsPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    async function fetchRepos() {
      try {
        const res = await fetch("/api/repos");
        if (!res.ok) throw new Error(`Failed: ${res.status}`);
        const data = await res.json();
        setRepos(data.repos ?? []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchRepos();
  }, []);

  const filtered = repos.filter((r) => {
    const matchSearch = r.repo_name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.repo_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Datasets</h1>
          <p className="mt-1 text-sm text-text-secondary">내가 접근할 수 있는 데이터셋 저장소 목록</p>
        </div>
        <Button
          className="bg-brand hover:bg-brand/90 text-white"
          onClick={() => router.push("/datasets/new")}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Dataset
        </Button>
      </div>

      {/* Search + type filter */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="저장소 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-dh-border bg-white p-1">
          {(["all", "A", "B"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-brand text-white"
                  : "text-text-secondary hover:bg-bg-surface"
              }`}
            >
              {t === "all" ? "All" : TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <p className="text-sm text-text-muted">불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dh-border bg-white py-16 text-center">
          <Database className="h-10 w-10 text-text-muted" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {search || typeFilter !== "all" ? "검색 결과가 없습니다" : "저장소가 없습니다"}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              {search || typeFilter !== "all"
                ? "다른 검색어 또는 필터를 사용해보세요"
                : "새 데이터셋 저장소를 만들어보세요"}
            </p>
          </div>
          {!search && typeFilter === "all" && (
            <Button
              size="sm"
              className="bg-brand hover:bg-brand/90 text-white"
              onClick={() => router.push("/datasets/new")}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Dataset
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dh-border bg-white divide-y divide-dh-border overflow-hidden">
          {filtered.map((repo) => {
            const repoPath = repo.repo_name.includes("/")
              ? repo.repo_name
              : `${repo.owner}/${repo.repo_name}`;

            return (
              <Link
                key={repo.repo_name}
                href={`/${repoPath}`}
                className="flex items-start gap-4 px-5 py-4 hover:bg-bg-surface transition-colors"
              >
                <Database className="h-5 w-5 shrink-0 text-text-muted mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary truncate">
                      {repo.repo_name}
                    </p>
                    {repo.repo_type && (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        {TYPE_LABEL[repo.repo_type]}
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-0.5 text-xs text-text-muted truncate">{repo.description}</p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-text-muted">
                    <VisibilityBadge visibility={repo.visibility} />
                    {/* fine_grained 는 capability subset 노출 — 자세한 내용은 상세 페이지 */}
                    {typeof repo.member_count === "number" && repo.member_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {repo.member_count}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(repo.created_at).toLocaleDateString("ko-KR")}
                    </span>
                    {repo.last_commit && (
                      <span className="flex items-center gap-1 max-w-[180px] truncate">
                        <GitCommitHorizontal className="h-3 w-3 shrink-0" />
                        <span className="font-mono">{repo.last_commit.hash.slice(0, 7)}</span>
                        <span className="truncate">{repo.last_commit.message}</span>
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    ROLE_BADGE[repo.role] ?? "bg-gray-50 text-gray-600"
                  }`}
                >
                  {repo.role}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-text-muted mt-0.5" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
