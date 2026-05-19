"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CircleDot,
  CircleCheck,
  Tag,
  MessageSquare,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import type { Issue, IssueComment } from "@/lib/platform-client";

export default function IssueDetailPage() {
  const { group, repo, issueNumber } = useParams<{
    group: string;
    repo: string;
    issueNumber: string;
  }>();
  const router = useRouter();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [issueRes, commentsRes] = await Promise.all([
          fetch(`/api/repos/${group}/${repo}/issues/${issueNumber}`),
          fetch(`/api/repos/${group}/${repo}/issues/${issueNumber}/comments`),
        ]);
        if (issueRes.ok) setIssue(await issueRes.json());
        if (commentsRes.ok) {
          const data = await commentsRes.json();
          setComments(data.comments ?? []);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [group, repo, issueNumber]);

  async function handleClose() {
    if (!issue) return;
    const res = await fetch(`/api/repos/${group}/${repo}/issues/${issueNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: issue.state === "open" ? "closed" : "open" }),
    });
    if (res.ok) setIssue(await res.json());
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/repos/${group}/${repo}/issues/${issueNumber}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: newComment }),
        },
      );
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setNewComment("");
        if (issue) setIssue({ ...issue, comment_count: issue.comment_count + 1 });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-text-secondary">불러오는 중...</div>;
  }

  if (!issue) {
    return (
      <EmptyState
        icon={CircleDot}
        title="이슈를 찾을 수 없습니다"
        description="삭제되었거나 접근 권한이 없는 이슈입니다."
        action={
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            목록으로
          </Button>
        }
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back nav */}
      <Link
        href={`/${group}/${repo}/issues`}
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        이슈 목록
      </Link>

      {/* Issue header */}
      <div>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-text-primary leading-snug">
              {issue.title}
              <span className="ml-2 text-text-secondary font-normal">#{issue.number}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {issue.state === "open" ? (
                <Badge className="bg-accent-green/10 text-accent-green border-accent-green/20">
                  <CircleDot className="mr-1 h-3 w-3" />
                  열린 이슈
                </Badge>
              ) : (
                <Badge className="bg-accent-blue/10 text-accent-blue border-accent-blue/20">
                  <CircleCheck className="mr-1 h-3 w-3" />
                  닫힌 이슈
                </Badge>
              )}
              <span className="text-sm text-text-secondary">
                <strong className="text-text-primary">{issue.author.name}</strong>님이{" "}
                {formatDate(issue.created_at)} 등록 · 댓글 {issue.comment_count}개
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClose}
          >
            {issue.state === "open" ? (
              <>
                <CircleCheck className="mr-1.5 h-4 w-4" />
                이슈 닫기
              </>
            ) : (
              <>
                <CircleDot className="mr-1.5 h-4 w-4" />
                이슈 다시 열기
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_220px] gap-6">
        {/* Main content */}
        <div className="space-y-4">
          {/* Issue body */}
          <div className="rounded-lg border border-dh-border bg-white">
            <div className="flex items-center justify-between border-b border-dh-border px-4 py-2.5 text-sm text-text-secondary">
              <span>
                <strong className="text-text-primary">{issue.author.name}</strong> · {formatDate(issue.created_at)}
              </span>
            </div>
            <div className="p-4 text-sm text-text-primary whitespace-pre-wrap min-h-[80px]">
              {issue.body || <span className="text-text-secondary italic">내용이 없습니다.</span>}
            </div>
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-lg border border-dh-border bg-white">
                  <div className="flex items-center border-b border-dh-border px-4 py-2.5 text-sm text-text-secondary">
                    <strong className="text-text-primary">{comment.author.name}</strong>
                    <span className="ml-2">{formatDate(comment.created_at)}</span>
                  </div>
                  <div className="p-4 text-sm text-text-primary whitespace-pre-wrap">
                    {comment.body}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New comment */}
          <form onSubmit={handleComment} className="space-y-2">
            <Textarea
              placeholder="댓글을 입력하세요..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={submitting || !newComment.trim()}>
                <Send className="mr-1.5 h-4 w-4" />
                {submitting ? "등록 중..." : "댓글 등록"}
              </Button>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-4 text-sm">
          {/* Labels */}
          <div>
            <p className="font-medium text-text-primary mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              라벨
            </p>
            {issue.labels.length === 0 ? (
              <p className="text-text-secondary">없음</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {issue.labels.map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{
                      backgroundColor: `${label.color}22`,
                      color: label.color,
                      border: `1px solid ${label.color}44`,
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Assignees */}
          <div>
            <p className="font-medium text-text-primary mb-2">담당자</p>
            {issue.assignees.length === 0 ? (
              <p className="text-text-secondary">없음</p>
            ) : (
              <ul className="space-y-1.5">
                {issue.assignees.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-accent-blue flex items-center justify-center text-white text-xs font-medium">
                      {a.name[0]}
                    </div>
                    <span className="text-text-primary">{a.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          {/* Meta */}
          <div className="space-y-1 text-text-secondary">
            <p>
              <span className="font-medium text-text-primary">작성자</span>{" "}
              {issue.author.name}
            </p>
            <p>
              <span className="font-medium text-text-primary">등록일</span>{" "}
              {formatDate(issue.created_at)}
            </p>
            {issue.closed_at && (
              <p>
                <span className="font-medium text-text-primary">닫힌 날짜</span>{" "}
                {formatDate(issue.closed_at)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
