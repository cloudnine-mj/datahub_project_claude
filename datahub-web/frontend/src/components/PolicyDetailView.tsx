"use client";

/**
 * 정책 상세 — 사용자 여정 Step 4 의 Opportunity 반영.
 *
 *  ┌─ TL;DR 박스 ───────────────────────────────┐  ← '결국 내가 해야 하는 건 뭐지?'
 *  ├─ ✅ 이 정책을 지키려면 (체크리스트)         │  ← '행동으로 번역'
 *  ├─ 본문                                       │
 *  └─ 💡 예시                                     │
 *
 * 메타필드가 비어있으면 해당 섹션은 자동으로 사라짐 — 단순 게시글에도 호환.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Lightbulb, Users } from "lucide-react";
import { api, type PostDetail } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { SeverityBadge } from "./SeverityBadge";
import { formatDate } from "@/lib/utils";

export function PolicyDetailView({ postId }: { postId: number }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api.getPost("policy", postId).then(setPost).catch((e) => setError((e as Error).message));
  }, [postId]);

  if (error) return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!post) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  const items = post.action_items ?? [];
  const doneCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="max-w-4xl">
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 관리 정책", href: "/governance/policy" },
          { label: post.title },
        ]}
      />

      {/* 헤더 — severity, 태그, 갱신일 */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <SeverityBadge severity={post.severity} />
        {(post.tags ?? []).map((t) => (
          <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-gray-600">#{t}</span>
        ))}
        <span className="ml-2 text-gray-400">갱신: {formatDate(post.updated_at)}</span>
        <span className="text-gray-400">· {post.author_name}</span>
      </div>

      <h1 className="mt-2 text-3xl font-bold tracking-tight">{post.title}</h1>
      {post.summary && <p className="mt-2 text-base text-gray-600">{post.summary}</p>}

      {post.applies_to && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
          <Users size={12} />
          <span>적용 대상: <strong className="font-semibold text-gray-800">{post.applies_to}</strong></span>
        </div>
      )}

      {/* TL;DR */}
      {post.tldr && (
        <section className="mt-6 rounded-lg border-l-4 border-brand bg-red-50/40 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-brand">TL;DR</div>
          <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-gray-900">{post.tldr}</p>
        </section>
      )}

      {/* 체크리스트 */}
      {items.length > 0 && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CheckCircle2 size={18} className="text-emerald-500" />
              이 정책을 지키려면
            </h2>
            <span className="text-xs text-gray-400">
              {doneCount} / {items.length} 완료
            </span>
          </div>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id={`act-${i}`}
                  checked={!!checked[i]}
                  onChange={(e) => setChecked((prev) => ({ ...prev, [i]: e.target.checked }))}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
                />
                <label
                  htmlFor={`act-${i}`}
                  className={
                    "flex-1 cursor-pointer text-sm leading-relaxed " +
                    (checked[i] ? "text-gray-400 line-through" : "text-gray-800")
                  }
                >
                  {it}
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-400">
            ※ 체크는 본인 확인용입니다 — 서버에 저장되지 않습니다.
          </p>
        </section>
      )}

      {/* 본문 */}
      {post.content && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <FileText size={18} className="text-gray-500" />
            정책 본문
          </h2>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
            {post.content}
          </div>
        </section>
      )}

      {/* 예시 */}
      {post.examples && (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50/40 p-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-amber-900">
            <Lightbulb size={18} />
            예시
          </h2>
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-900/90">
            {post.examples}
          </div>
        </section>
      )}

      {/* 첨부 */}
      {post.attachments.length > 0 && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold">첨부 파일 ({post.attachments.length})</h2>
          <ul className="mt-2 space-y-1.5">
            {post.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">📎</span>
                <span>{a.filename}</span>
                <span className="text-xs text-gray-400">({Math.round(a.size_bytes / 1024)} KB)</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
