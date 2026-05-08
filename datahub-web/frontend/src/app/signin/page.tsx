"use client";

/**
 * 로그인 페이지 — 스토리보드 WjgHD (메인 인증 진입).
 *
 * - 카드 중앙 정렬, LGAIR DataHub 브랜딩
 * - "Sign in with SSO" 클릭 → plat-api `/api/v1/auth/login` redirect
 *   (env NEXT_PUBLIC_PLATFORM_API_BASE 미지정 시 same-origin 으로 호출)
 * - 로컬 mock 모드: localhost:8000 backend 가 OAuth endpoint 없으면 즉시
 *   기본 admin 으로 로그인하는 `mock=1` 분기 (개발 편의)
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PLATFORM_AUTH_LOGIN_URL, setUserEmail } from "@/lib/api";

const MOCK_DEMO_EMAIL = "karlo.lee@example.com";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams?.get("error");
  const [busy, setBusy] = useState(false);

  function handleSso() {
    setBusy(true);

    // 환경 변수가 plat-api 를 가리키지 않으면 (= 로컬 mock 환경) 즉시 mock 로그인.
    // 향후 NEXT_PUBLIC_PLATFORM_API_BASE 가 설정되면 자연스럽게 OAuth 흐름으로 전환.
    const usingMock =
      typeof process !== "undefined" && !process.env?.NEXT_PUBLIC_PLATFORM_API_BASE;
    if (usingMock) {
      setUserEmail(MOCK_DEMO_EMAIL);
      router.push("/");
      return;
    }

    // plat-api OAuth — 콜백이 platform_token 쿠키를 세팅하고 state 로 redirect 해줌
    const back = window.location.origin;
    window.location.href = `${PLATFORM_AUTH_LOGIN_URL}?redirect_uri=${encodeURIComponent(back)}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Compact Header */}
      <header className="flex h-14 items-center border-b border-gray-100 px-6">
        <div className="flex items-center gap-2">
          <span className="block h-3 w-3 rounded-sm bg-brand" />
          <span className="text-base font-bold tracking-tight">LGAIR DataHub</span>
        </div>
      </header>

      {/* 중앙 카드 */}
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2.5">
            <span className="block h-7 w-7 rounded bg-brand" />
            <h1 className="text-2xl font-bold tracking-tight" style={{ letterSpacing: "-0.5px" }}>
              <span className="text-brand">LGAIR</span> <span className="text-gray-900">DataHub</span>
            </h1>
          </div>
          <p className="mt-3 text-sm text-gray-500">사내 AI 데이터 플랫폼에 오신 것을 환영합니다</p>
        </div>

        <div className="mt-8 w-full max-w-[420px] rounded-2xl border border-gray-100 bg-white p-12 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <h2 className="text-xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1 text-sm text-gray-500">사내 계정으로 로그인하세요.</p>

          {errorParam && (
            <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
              로그인에 실패했습니다 ({errorParam}). 잠시 후 다시 시도해 주세요.
            </div>
          )}

          <button
            type="button"
            onClick={handleSso}
            disabled={busy}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white text-[15px] font-medium text-gray-900 transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-60"
          >
            <SsoIcon />
            {busy ? "로그인 중..." : "Sign in with SSO"}
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gray-100" />
            <span className="text-xs text-gray-400">or</span>
            <span className="h-px flex-1 bg-gray-100" />
          </div>

          <p className="text-center text-xs text-gray-400">SSO 자동 로그인이 설정되어 있습니다.</p>

          <p className="mt-8 text-center text-[11px] text-gray-400">
            Powered by LG AI Research · Data Governance Team
          </p>
        </div>
      </main>

      {/* Compact Footer */}
      <footer className="flex h-12 items-center justify-between border-t border-gray-100 px-6 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className="block h-2 w-2 rounded-sm bg-brand" />
          <span>© 2025 LG Electronics</span>
        </div>
        <div className="flex items-center gap-4">
          <a className="hover:text-gray-600" href="#">Terms</a>
          <a className="hover:text-gray-600" href="#">Privacy</a>
          <a className="hover:text-gray-600" href="#">Docs</a>
          <a className="hover:text-gray-600" href="#">Status</a>
        </div>
      </footer>
    </div>
  );
}

function SsoIcon() {
  // SSO 일반 아이콘 — 회사 결정에 따라 Google / Microsoft 로고로 교체 가능
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" fill="#F25022" />
      <rect x="13" y="3" width="8" height="8" fill="#7FBA00" />
      <rect x="3" y="13" width="8" height="8" fill="#00A4EF" />
      <rect x="13" y="13" width="8" height="8" fill="#FFB900" />
    </svg>
  );
}
