"use client";

/**
 * 정책 상세 — 사용자 여정 Step 4 의 Opportunity 반영.
 *
 *  ┌─ 핵심 요약 박스 ────────────────────────────┐  ← '결국 내가 해야 하는 건 뭐지?'
 *  ├─ ✅ 이 정책을 지키려면 (체크리스트)         │  ← '행동으로 번역'
 *  ├─ 본문                                       │
 *  └─ 💡 예시                                     │
 *
 * 메타필드가 비어있으면 해당 섹션은 자동으로 사라짐 — 단순 게시글에도 호환.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Lightbulb, Users } from "lucide-react";
import { api, type Me, type PostDetail } from "@/lib/api";
import { Breadcrumb } from "./Breadcrumb";
import { SeverityBadge } from "./SeverityBadge";
import { DeletePostButton } from "./DeletePostButton";
import { formatDate } from "@/lib/utils";

/**
 * 예시 본문에서 ✅/❌ 같은 선두 이모지 1자만 제거.
 * 기존 시드에 들어간 데이터를 DB 재생성 없이 깔끔하게 보이기 위함.
 *
 * 예: "✅ 올바른 사례\n- ..."  →  "올바른 사례\n- ..."
 */
function stripExampleEmojis(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^[✅❌✨⭐⚠️]\s*/u, ""))
    .join("\n");
}

/**
 * 본문 렌더 — 라이브러리 없이 가벼운 변환만:
 *   - "## 헤딩" / "# 헤딩" 으로 시작하는 줄 → 굵은 헤딩
 *   - 빈 줄 → 단락 구분
 *   - 그 외 → 일반 텍스트 (whitespace 보존)
 */
function PolicyContent({ text }: { text: string }) {
  const blocks: { type: "h" | "p"; content: string }[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      blocks.push({ type: "p", content: buffer.join("\n") });
      buffer = [];
    }
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "h", content: heading[1] });
    } else if (line === "") {
      flush();
    } else {
      buffer.push(raw);
    }
  }
  flush();

  return (
    <div className="space-y-3">
      {blocks.map((b, i) =>
        b.type === "h" ? (
          <h3 key={i} className="mt-2 text-sm font-bold text-gray-900">
            {b.content}
          </h3>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            {b.content}
          </p>
        ),
      )}
    </div>
  );
}

export function PolicyDetailView({ postId }: { postId: number }) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api.getPost("policy", postId).then(setPost).catch((e) => setError((e as Error).message));
    api.me().then(setMe).catch(() => setMe(null));
  }, [postId]);

  if (error) return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!post) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  // 삭제 권한: admin 이거나 작성자 본인. 백엔드도 동일하게 검증함.
  const canDelete = !!me && (me.user.role === "admin" || me.user.name === post.author_name);

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

      <div className="mt-2 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">{post.title}</h1>
        {canDelete && (
          <DeletePostButton board="policy" postId={post.id} redirectTo="/governance/policy" />
        )}
      </div>
      {post.summary && <p className="mt-2 text-base text-gray-600">{post.summary}</p>}

      {post.applies_to && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
          <Users size={12} />
          <span>적용 대상: <strong className="font-semibold text-gray-800">{post.applies_to}</strong></span>
        </div>
      )}

      {/* 핵심 요약 */}
      {post.tldr && (
        <section className="mt-6 rounded-lg border-l-4 border-brand bg-red-50/40 p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-brand">핵심 요약</div>
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
        </section>
      )}

      {/* 본문 */}
      {post.content && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <FileText size={18} className="text-gray-500" />
            정책 본문
          </h2>
          <div className="mt-3 text-sm leading-relaxed text-gray-800">
            <PolicyContent text={post.content} />
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
            {stripExampleEmojis(post.examples)}
          </div>
        </section>
      )}

      {/* 본문 렌더 끝 */}

      {/* 첨부 */}
      {post.attachments.length > 0 && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold">첨부 파일 ({post.attachments.length})</h2>
          <ul className="mt-2 space-y-1.5">
            {post.attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-gray-400">📎</span>
                  <span className="truncate">{a.filename}</span>
                  <span className="shrink-0 text-xs text-gray-400">
                    ({Math.round(a.size_bytes / 1024)} KB)
                  </span>
                </div>
                <a
                  href={api.postAttachmentUrl("policy", post.id, a.id)}
                  className="shrink-0 rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  다운로드
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
