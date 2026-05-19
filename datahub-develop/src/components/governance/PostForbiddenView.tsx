"use client";

// 화면 12: 글쓰기 권한 없음.
// 셀프서비스 권한 요청 경로 제공 (mailto 링크).
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, Mail } from "lucide-react";

const ADMIN_EMAIL = "datahub-governance@example.com";

export function PostForbiddenView() {
  const router = useRouter();

  const subject = "[DataHub] 게시판 글쓰기 권한 요청";
  const body =
    "안녕하세요,%0A%0A" +
    "DataHub Governance 게시판에 글을 작성할 수 있는 권한을 요청합니다.%0A%0A" +
    "- 신청자 이름: %0A" +
    "- 소속/팀: %0A" +
    "- 사용 목적: %0A%0A" +
    "감사합니다.";
  const mailto = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-red-50 text-brand">
        <Lock size={28} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">글쓰기 권한이 없습니다</h1>
      <p className="mt-2 text-sm text-gray-500">이 게시판에 글을 작성할 권한이 없습니다.</p>
      <p className="mt-1 text-xs text-gray-400">
        권한이 필요하시면 거버넌스 관리자에게 요청해 주세요.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
        <a
          href={mailto}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark"
        >
          <Mail size={14} /> 권한 요청하기
        </a>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          <ArrowLeft size={14} /> 돌아가기
        </button>
      </div>

      <p className="mt-4 text-[11px] text-gray-400">
        문의:{" "}
        <a href={`mailto:${ADMIN_EMAIL}`} className="underline hover:text-gray-600">
          {ADMIN_EMAIL}
        </a>
      </p>
    </div>
  );
}
