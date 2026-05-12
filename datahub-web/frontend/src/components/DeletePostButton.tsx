"use client";

/**
 * 게시글 삭제 버튼 + 확인 다이얼로그.
 *
 * 노출 조건: 작성자 본인 또는 admin (호출 측에서 me/post 비교 후 prop 으로 결정).
 * 삭제 성공 시 게시판 목록으로 이동.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, type BoardType } from "@/lib/api";

interface Props {
  board: BoardType;
  postId: number;
  /** 삭제 후 이동할 경로 (예: "/governance/policy"). onDeleted 와 둘 중 하나는 지정. */
  redirectTo?: string;
  /** 삭제 후 부모가 목록 재조회 등 후속 처리. redirectTo 와 함께 쓰일 수도 있음. */
  onDeleted?: () => void;
}

export function DeletePostButton({ board, postId, redirectTo, onDeleted }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setError(null);
    setPending(true);
    try {
      await api.deletePost(board, postId);
      if (onDeleted) onDeleted();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
      >
        <Trash2 size={12} /> 삭제
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">정말 삭제하시겠습니까?</h3>
            <p className="mt-2 text-sm text-gray-600">
              삭제된 글은 복구할 수 없습니다. 첨부된 파일도 함께 삭제됩니다.
            </p>
            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className="inline-flex items-center gap-1 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 size={14} /> {pending ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
