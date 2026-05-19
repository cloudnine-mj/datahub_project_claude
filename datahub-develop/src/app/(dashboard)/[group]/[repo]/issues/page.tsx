"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CircleDot, CircleCheck, Plus, Search, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import type { Issue } from "@/lib/platform-client";

const STATE_OPTIONS = [
  { value: "open", label: "열린 이슈" },
  { value: "closed", label: "닫힌 이슈" },
  { value: "all", label: "전체" },
];

export default function IssuesPage() {
  const { group, repo } = useParams<{ group: string; repo: string }>();
  const router = useRouter();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"open" | "closed" | "all">("open");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchIssues() {
      setLoading(true);
      try {
        const sp = new URLSearchParams({ state });
        const res = await fetch(`/api/repos/${group}/${repo}/issues?${sp}`);
        if (res.ok) {
          const data = await res.json();
          setIssues(Array.isArray(data.issues) ? data.issues : []);
          setTotal(data.total ?? 0);
        } else {
          setIssues([]);
        }
      } catch {
        setIssues([]);
      } finally {
        setLoading(false);
      }
    }
    fetchIssues();
  }, [group, repo, state]);

  const filtered = search
    ? issues.filter((i) => i.title.toLowerCase().includes(search.toLowerCase()))
    : issues;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">Issues</h1>
        <Button size="sm" disabled title="이슈 생성은 준비 중입니다">
          <Plus className="mr-1.5 h-4 w-4" />
          새 이슈
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="이슈 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={state} onValueChange={(v) => setState(v as typeof state)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Issue list */}
      <div className="rounded-lg border border-dh-border bg-white">
        {/* List header */}
        <div className="flex items-center gap-4 border-b border-dh-border px-4 py-2.5 text-sm text-text-secondary">
          <button
            className={state === "open" ? "font-semibold text-text-primary" : "hover:text-text-primary"}
            onClick={() => setState("open")}
          >
            <CircleDot className="mr-1 inline h-4 w-4 text-accent-green" />
            열린 이슈{state === "open" && total > 0 ? ` ${total}` : ""}
          </button>
          <button
            className={state === "closed" ? "font-semibold text-text-primary" : "hover:text-text-primary"}
            onClick={() => setState("closed")}
          >
            <CircleCheck className="mr-1 inline h-4 w-4 text-accent-blue" />
            닫힌 이슈
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="py-12 text-center text-sm text-text-secondary">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CircleDot}
            title={search ? "검색 결과가 없습니다" : state === "open" ? "열린 이슈가 없습니다" : "닫힌 이슈가 없습니다"}
            description={
              search
                ? `"${search}"에 해당하는 이슈를 찾을 수 없습니다.`
                : state === "open"
                ? "새 이슈를 만들어 작업을 추적해 보세요."
                : undefined
            }
            action={
              !search && state === "open" ? (
                <Button size="sm" variant="outline" disabled title="이슈 생성은 준비 중입니다">
                  <Plus className="mr-1.5 h-4 w-4" />새 이슈 만들기
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-dh-border">
            {filtered.map((issue) => (
              <li
                key={issue.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-bg-surface cursor-pointer"
                onClick={() => router.push(`/${group}/${repo}/issues/${issue.number}`)}
              >
                {issue.state === "open" ? (
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" />
                ) : (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-blue" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-text-primary hover:text-accent-blue">
                      {issue.title}
                    </span>
                    {issue.labels.map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${label.color}22`,
                          color: label.color,
                          border: `1px solid ${label.color}44`,
                        }}
                      >
                        <Tag className="h-3 w-3" />
                        {label.name}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    #{issue.number} · {issue.author.name}님이{" "}
                    {formatDate(issue.created_at)} 등록
                    {issue.comment_count > 0 && ` · 댓글 ${issue.comment_count}개`}
                  </p>
                </div>
                {issue.assignees.length > 0 && (
                  <div className="flex -space-x-1">
                    {issue.assignees.slice(0, 3).map((a) => (
                      <div
                        key={a.id}
                        className="h-6 w-6 rounded-full bg-accent-blue flex items-center justify-center text-white text-xs font-medium ring-2 ring-white"
                        title={a.name}
                      >
                        {a.name[0]}
                      </div>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
