"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

function DeviceSuccessContent() {
  const email = useSearchParams().get("email") ?? "";

  return (
    <div className="w-full max-w-sm">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-brand">LGAIR</span>
          <span className="font-heading text-2xl font-semibold text-text-primary">DataHub</span>
        </Link>
      </div>

      {/* Success Card */}
      <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>

        <h1 className="font-heading text-lg font-semibold text-text-primary mb-2">
          로그인 완료
        </h1>

        {email && (
          <p className="text-sm text-text-secondary mb-4">
            {email}
          </p>
        )}

        <p className="text-sm text-text-secondary">
          터미널/노트북으로 돌아가세요. 잠시 후 자동 완료됩니다.
          <br />
          이 창은 닫아도 됩니다.
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

export default function DeviceSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-surface px-4">
      <Suspense>
        <DeviceSuccessContent />
      </Suspense>
    </div>
  );
}
