"use client";

/**
 * 로그인 페이지 — 사내 SSO 단일 진입.
 *
 * 현재는 mock — SSO 버튼 클릭 시 default admin 으로 즉시 로그인.
 * 실제 OAuth 통합 시 이 핸들러만 교체하면 됨.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setUserEmail } from "@/lib/api";

const DEFAULT_DEMO_EMAIL = "karlo.lee@example.com";

export default function SignInPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function handleSso() {
    setBusy(true);
    // mock SSO — 실제로는 OAuth redirect 흐름이 들어가야 함
    setUserEmail(DEFAULT_DEMO_EMAIL);
    router.push("/");
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gray-50/80 px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-brand">LGAIR</span>{" "}
            <span className="text-gray-900">DataHub</span>
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            조직 내 AI/ML 데이터 자산 관리 플랫폼
          </p>
        </div>

        <div className="mt-10 w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-gray-500">사내 계정으로 로그인하세요.</p>

          <button
            type="button"
            onClick={handleSso}
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
          >
            <GoogleGIcon />
            {busy ? "로그인 중..." : "Sign in with SSO"}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            사내 계정만 지원됩니다. 별도 회원가입이 필요하지 않습니다.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="text-sm text-gray-400 hover:text-gray-600"
      >
        홈으로 돌아가기
      </button>
    </div>
  );
}

function GoogleGIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v3.2h5.35c-.23 1.4-.92 2.58-1.96 3.36v2.79h3.16c1.85-1.7 2.92-4.21 2.92-7.18 0-.7-.06-1.37-.17-2.02l-.95-.15z"
      />
      <path
        fill="currentColor"
        d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.16-2.45c-.88.59-2 .94-3.46.94-2.66 0-4.92-1.79-5.73-4.2H3v2.64C4.65 19.86 8.06 22 12 22z"
      />
      <path
        fill="currentColor"
        d="M6.27 13.86a6 6 0 010-3.73V7.5H3a10 10 0 000 9l3.27-2.64z"
      />
      <path
        fill="currentColor"
        d="M12 6.27c1.47 0 2.79.51 3.83 1.5l2.86-2.86C16.97 3.42 14.7 2.5 12 2.5 8.06 2.5 4.65 4.64 3 7.5l3.27 2.63C7.08 8.06 9.34 6.27 12 6.27z"
      />
    </svg>
  );
}
