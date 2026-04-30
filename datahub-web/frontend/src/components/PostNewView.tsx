"use client";

// 화면 7: 새 글 작성 폼 — 권한 있는 사용자만 진입 (없으면 PostForbiddenView)
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Paperclip } from "lucide-react";
import { api, type BoardType, type Me } from "@/lib/api";
import { boardSegment } from "./BoardListView";

const CATEGORIES = ["가이드", "공지", "정책", "FAQ"];

export function PostNewView({ board }: { board: BoardType }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.me().then(setMe);
  }, []);

  // 권한 없는 사용자가 직접 URL 로 진입한 경우 화면 12 로 강제 이동
  useEffect(() => {
    if (me && !me.permissions[`can_write_${board}` as const]) {
      router.replace(`/governance/${boardSegment(board)}/forbidden`);
    }
  }, [me, board, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.createPost(board, { title, category: category || undefined, content });
      router.push(`/governance/${boardSegment(board)}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">새 글 작성</h1>

      <form
        onSubmit={onSubmit}
        className="mt-6 rounded-lg border border-gray-200 bg-white p-8"
      >
        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="제목을 입력하세요"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">카테고리</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full appearance-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
            >
              <option value="">카테고리를 선택하세요</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={10}
              placeholder="내용을 입력하세요"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-400">
              <Paperclip size={14} />
              파일 첨부 (드래그하거나 클릭하세요)
            </div>
          </div>

          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-md border border-gray-200 px-5 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
