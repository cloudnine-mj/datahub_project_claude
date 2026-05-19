"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked: "이미 다른 방법으로 가입된 이메일입니다.",
  OAuthCallbackError: "인증 중 오류가 발생했습니다.",
  CredentialsSignin: "인증에 실패했습니다. 다시 시도해주세요.",
  SessionExpired: "세션이 만료되었습니다. 다시 로그인해주세요.",
  default: "로그인에 실패했습니다. 다시 시도해주세요.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.default
    : null;

  const handleLogin = () => {
    window.location.href = "/api/auth/login?redirect_uri=/";
  };

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-brand">LGAIR</span>
          <span className="font-heading text-2xl font-semibold text-text-primary">DataHub</span>
        </Link>
        <p className="mt-2 text-sm text-text-secondary">
          조직 내 AI/ML 데이터 자산 관리 플랫폼
        </p>
      </div>

      {/* Login Card */}
      <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm">
        <h1 className="font-heading text-lg font-semibold text-text-primary mb-1">Sign in</h1>
        <p className="text-sm text-text-secondary mb-6">
          사내 계정으로 로그인하세요.
        </p>

        {errorMessage && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* SSO Login Button — Google OAuth (MS SSO 전환 예정) */}
        <Button
          className="w-full bg-brand hover:bg-brand/90 text-white"
          onClick={handleLogin}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with SSO
        </Button>

        <p className="mt-4 text-center text-xs text-text-muted">
          사내 계정만 지원됩니다. 별도 회원가입이 필요하지 않습니다.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-text-muted">
        <Link href="/" className="hover:text-text-secondary transition-colors">
          홈으로 돌아가기
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-surface px-4">
      <Suspense>
        <LoginContent />
      </Suspense>
    </div>
  );
}
