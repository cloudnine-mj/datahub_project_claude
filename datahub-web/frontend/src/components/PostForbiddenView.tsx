"use client";

// 화면 12: 글쓰기 권한 없음
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";

export function PostForbiddenView() {
  const router = useRouter();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-red-50 text-brand">
        <Lock size={28} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">글쓰기 권한이 없습니다</h1>
      <p className="mt-2 text-sm text-gray-500">이 게시판에 글을 작성할 권한이 없습니다.</p>
      <p className="mt-1 text-xs text-gray-400">권한이 필요하시면 관리자에게 문의해 주세요.</p>
      <button
        onClick={() => router.back()}
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-gray-200 px-5 py-2 text-sm font-semibold hover:bg-gray-50"
      >
        <ArrowLeft size={14} /> 돌아가기
      </button>
    </div>
  );
}
