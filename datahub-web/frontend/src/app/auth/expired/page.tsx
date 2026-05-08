"use client";

// 세션 만료 화면 — 스토리보드 b1Dat.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Timer } from "lucide-react";

export default function SessionExpiredPage() {
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
          <Timer size={48} className="text-gray-400" />
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">세션이 만료되었습니다</h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-gray-500">
          보안을 위해 세션이 자동으로 종료되었습니다.
          <br />
          다시 로그인하여 계속 이용해 주세요.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => router.push("/signin")}
            className="rounded-md bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark"
          >
            다시 로그인
          </button>
          <Link
            href="/"
            className="rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            홈으로 이동
          </Link>
        </div>
        <p className="mt-6 text-xs text-gray-400">SSO 로 자동 재인증이 시도됩니다.</p>
        <div className="mt-6 flex gap-6 text-xs">
          <a className="text-blue-600 hover:underline" href="#">
            도움말 센터
          </a>
          <a className="text-blue-600 hover:underline" href="#">
            IT 지원 문의
          </a>
        </div>
      </main>

      <footer className="flex h-12 items-center justify-between border-t border-gray-100 px-6 text-xs text-gray-400">
        <span>© 2025 LG Electronics</span>
      </footer>
    </div>
  );
}
