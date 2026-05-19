"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Terminal } from "lucide-react";

function PasteContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const [copied, setCopied] = useState(false);

  if (!code) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm text-center">
          <p className="text-sm text-red-700">
            유효하지 않은 요청입니다. 인증 코드가 전달되지 않았습니다.
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API 불가능 — textarea 를 수동 선택 가능하게 이미 둠
    }
  };

  return (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-brand">LGAIR</span>
          <span className="font-heading text-2xl font-semibold text-text-primary">DataHub</span>
        </Link>
        <p className="mt-2 text-sm text-text-secondary">로그인 완료 — 코드 전달</p>
      </div>

      {/* Paste Card */}
      <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <Terminal className="h-6 w-6 text-brand shrink-0" />
          <h1 className="font-heading text-lg font-semibold text-text-primary">
            CLI 인증 코드
          </h1>
        </div>

        <p className="text-sm text-text-secondary mb-4">
          아래 코드를 복사해 터미널/노트북에 붙여넣으세요. 이 코드는 1회용이며
          30분 내 사용해야 합니다.
        </p>

        <div className="mb-4">
          <textarea
            readOnly
            value={code}
            className="w-full h-28 resize-none rounded-lg border border-dh-border bg-bg-surface px-3 py-2 font-mono text-xs text-text-primary break-all"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>

        <Button
          className="w-full bg-brand hover:bg-brand/90 text-white"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              복사됨
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              코드 복사
            </>
          )}
        </Button>

        <p className="mt-4 text-center text-xs text-text-muted">
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

export default function PastePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-surface px-4">
      <Suspense>
        <PasteContent />
      </Suspense>
    </div>
  );
}
