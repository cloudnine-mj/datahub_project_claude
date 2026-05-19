/**
 * Governance 게시글 상세 — policy / process 보드 공용.
 * 마크다운 본문 + 정책 메타 (severity / TL;DR / action items / examples).
 */

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pin } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { governanceApi, type GovernancePostItem } from "@/lib/governance/api-client";

interface Props {
  board: "policy" | "process";
  id: string;
}

const severityColors: Record<string, string> = {
  low: "bg-gray-50 text-gray-700 border-gray-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200",
};

export function PostDetail({ board, id }: Props) {
  const [post, setPost] = useState<GovernancePostItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    governanceApi
      .getPost(id)
      .then((p) => {
        if (!cancelled) setPost(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (!post) {
    return <div className="text-sm text-text-muted">불러오는 중...</div>;
  }

  const isPolicy = post.boardType === "policy";

  return (
    <div className="space-y-6">
      <Link
        href={`/governance/${board}`}
        className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-brand"
      >
        <ArrowLeft className="h-3 w-3" />
        목록으로
      </Link>

      <header>
        <div className="flex items-center gap-2">
          {post.pinned && <Pin className="h-3.5 w-3.5 text-amber-600" />}
          {post.docType && (
            <span className="rounded-full border border-dh-border bg-bg-surface px-2 py-0.5 text-[11px] text-text-secondary">
              {post.docType}
            </span>
          )}
          {post.severity && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${severityColors[post.severity] ?? "border-dh-border"}`}
            >
              {post.severity}
            </span>
          )}
        </div>
        <h1 className="mt-2 font-heading text-2xl font-semibold text-text-primary">
          {post.title}
        </h1>
        <div className="mt-2 text-xs text-text-muted">
          {post.authorName} · {new Date(post.createdAt).toLocaleDateString("ko-KR")}
          {post.category && (
            <>
              {" · "}
              <span className="rounded-full border border-dh-border bg-bg-surface px-2 py-0.5">
                {post.category}
              </span>
            </>
          )}
        </div>
      </header>

      {isPolicy && post.summary && (
        <section className="rounded-xl border border-dh-border bg-bg-surface p-4 text-sm text-text-secondary">
          {post.summary}
        </section>
      )}

      {isPolicy && post.tldr && (
        <section className="rounded-xl border border-dh-border bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-text-primary">TL;DR</h2>
          <p className="text-sm text-text-secondary">{post.tldr}</p>
        </section>
      )}

      <article className="prose prose-sm max-w-none rounded-xl border border-dh-border bg-white p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
      </article>

      {isPolicy && post.actionItems && post.actionItems.length > 0 && (
        <section className="rounded-xl border border-dh-border bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-text-primary">Action Items</h2>
          <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
            {post.actionItems.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {isPolicy && post.examples && (
        <section className="rounded-xl border border-dh-border bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-text-primary">Examples</h2>
          <pre className="whitespace-pre-wrap text-xs text-text-secondary">{post.examples}</pre>
        </section>
      )}

      {isPolicy && post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((t) => (
            <span key={t} className="rounded bg-bg-surface px-1.5 py-0.5 text-xs text-text-secondary">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
