"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, X } from "lucide-react";

const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL || "http://localhost:8643";

function DeviceAuthContent() {
  const searchParams = useSearchParams();
  const deviceCode = searchParams.get("device_code");
  const userCode = searchParams.get("user_code");

  if (!deviceCode) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm text-center">
          <p className="text-sm text-red-700">
            유효하지 않은 요청입니다. device_code가 없습니다.
          </p>
          <Link
            href="/"
            className="mt-4 block text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const handleApprove = () => {
    const url = new URL(`${PLATFORM_API_URL}/api/v1/auth/device/authorize`);
    url.searchParams.set("device_code", deviceCode);
    window.location.href = url.toString();
  };

  const handleDeny = () => {
    window.location.href = "/";
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
          디바이스 인증 요청
        </p>
      </div>

      {/* Device Auth Card */}
      <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-brand shrink-0" />
          <h1 className="font-heading text-lg font-semibold text-text-primary">
            CLI 접근 승인
          </h1>
        </div>

        <p className="text-sm text-text-secondary mb-4">
          DataHub CLI 또는 SDK가 현재 계정으로의 접근을 요청하고 있습니다.
          본인이 요청한 것이 맞다면 승인하세요.
        </p>

        {userCode && (
          <div className="mb-6 rounded-lg bg-bg-surface border border-dh-border px-4 py-3 text-center">
            <p className="text-xs text-text-muted mb-1">인증 코드</p>
            <p className="font-mono text-lg font-semibold tracking-widest text-text-primary">
              {userCode}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Button
            className="w-full bg-brand hover:bg-brand/90 text-white"
            onClick={handleApprove}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            승인
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleDeny}
          >
            <X className="mr-2 h-4 w-4" />
            거부
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          본인이 요청하지 않은 경우 거부를 클릭하세요.
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

export default function DevicePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-surface px-4">
      <Suspense>
        <DeviceAuthContent />
      </Suspense>
    </div>
  );
}
