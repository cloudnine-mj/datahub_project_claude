"use client";

// 404 — 스토리보드 u3ZfI.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileX } from "lucide-react";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex h-14 items-center border-b border-gray-100 px-6">
        <div className="flex items-center gap-2">
          <span className="block h-3 w-3 rounded-sm bg-brand" />
          <span className="text-base font-bold tracking-tight">LGAIR DataHub</span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="grid h-[120px] w-[120px] place-items-center rounded-full border border-gray-100 bg-white">
          <FileX size={48} className="text-gray-400" />
        </div>
        <h1 className="mt-6 text-7xl font-bold tracking-tight" style={{ letterSpacing: "-2px" }}>
          404
        </h1>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">페이지를 찾을 수 없습니다</h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-gray-500">
          요청하신 페이지가 존재하지 않거나, 이동되었거나, 삭제되었을 수 있습니다.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/"
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            홈으로 돌아가기
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            이전 페이지
          </button>
        </div>
        <div className="mt-6 flex gap-4 text-xs">
          <a className="text-blue-600 hover:underline" href="#">
            도움말 센터
          </a>
          <a className="text-blue-600 hover:underline" href="#">
            문의하기
          </a>
          <a className="text-blue-600 hover:underline" href="#">
            상태 페이지
          </a>
        </div>
      </main>

      <footer className="flex h-12 items-center justify-between border-t border-gray-100 px-6 text-xs text-gray-400">
        <span>© 2025 LG Electronics</span>
      </footer>
    </div>
  );
}
