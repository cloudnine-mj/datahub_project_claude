"use client";

/**
 * 신청서 댓글 스레드 — HuggingFace Discussion 스타일.
 *
 * 권한: 신청서 조회 권한과 동일 (제출자 본인 또는 admin). 백엔드에서 강제.
 * 화면:
 *  - 헤더: 'Discussions' + 댓글 수
 *  - 빈 상태: 메시지 아이콘 + '첫 댓글을 남겨주세요'
 *  - 댓글 리스트: avatar(이니셜) / 이름 + role badge / 시간 / 본문 / 삭제 버튼
 *  - 작성 폼: textarea + '댓글 게시' 버튼
 */

import { useCallback, useEffect, useState } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
import { api, type FormCommentItem, type Me } from "@/lib/api";

interface Props {
  formId: number;
  me: Me | null;
}

export function FormCommentSection({ formId, me }: Props) {
  const [items, setItems] = useState<FormCommentItem[] | null>(null);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    api
      .listFormComments(formId)
      .then(setItems)
      .catch(() => setItems([]));
  }, [formId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function onPost() {
    const text = body.trim();
    if (!text) return;
    setError(null);
    setPosting(true);
    try {
      await api.createFormComment(formId, text);
      setBody("");
      refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function onDelete(commentId: number) {
    if (!confirm("이 댓글을 삭제할까요?")) return;
    try {
      await api.deleteFormComment(formId, commentId);
      refetch();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const count = items?.length ?? 0;

  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-bold">Discussions</h2>
          <span className="text-xs text-gray-400">{count}개의 댓글</span>
        </div>
        <span className="text-[11px] text-gray-400">신청자 + 검토자 간 논의 공간</span>
      </header>

      {/* 본문 */}
      {items === null ? (
        <div className="px-5 py-10 text-center text-xs text-gray-400">불러오는 중...</div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              canDelete={!!me && (me.user.id === c.author_id || me.user.role === "admin")}
              onDelete={() => onDelete(c.id)}
            />
          ))}
        </ul>
      )}

      {/* 작성 폼 — 본인이 form 조회 가능하다면(이 페이지 진입 자체가 통과) 작성 가능 */}
      <div className="border-t border-gray-100 bg-gray-50/40 px-5 py-4">
        <div className="flex items-start gap-3">
          <Avatar name={me?.user.name ?? "?"} role={me?.user.role ?? "viewer"} />
          <div className="flex-1">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="검토 의견이나 문의 사항을 남겨주세요"
              className="w-full resize-y rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
            {error && (
              <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</div>
            )}
            <div className="mt-2 flex items-center justify-end gap-2">
              <span className="text-[11px] text-gray-400">{body.length} / 4000</span>
              <button
                type="button"
                onClick={onPost}
                disabled={posting || !body.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
              >
                <MessageSquarePlus size={12} />
                {posting ? "게시 중..." : "댓글 게시"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-blue-500">
        <MessageSquarePlus size={20} />
      </div>
      <h3 className="mt-4 text-base font-bold">첫 댓글을 남겨주세요</h3>
      <p className="mt-1 text-xs text-gray-500">아직 이 신청서에 작성된 댓글이 없습니다.</p>
    </div>
  );
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
}: {
  comment: FormCommentItem;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-start gap-3 px-5 py-4">
      <Avatar name={comment.author_name} role={comment.author_role} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-800">{comment.author_name}</span>
          <RoleBadge role={comment.author_role} />
          <span className="text-[11px] text-gray-400">{formatRelative(comment.created_at)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
          {comment.body}
        </p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="댓글 삭제"
          className="text-gray-300 transition hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      )}
    </li>
  );
}

function Avatar({ name, role }: { name: string; role: string }) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const bg =
    role === "admin"
      ? "bg-red-100 text-red-700"
      : role === "editor"
      ? "bg-blue-100 text-blue-700"
      : "bg-gray-100 text-gray-600";
  return (
    <span
      className={
        "grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold " + bg
      }
    >
      {initial}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const cls =
    role === "admin"
      ? "bg-red-50 text-red-600"
      : role === "editor"
      ? "bg-blue-50 text-blue-600"
      : "bg-gray-100 text-gray-500";
  return (
    <span className={"rounded px-1.5 py-0.5 text-[10px] font-bold " + cls}>{role}</span>
  );
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "방금 전";
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}일 전`;
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}
