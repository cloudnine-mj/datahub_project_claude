"use client";

// CLI / SDK 로그인 완료 페이지 (mode=cli).
// Web 로그인은 datahub-api 콜백이 platform_token 쿠키를 세팅한 뒤 곧바로 `/` 로
// 돌려보내므로 이 페이지를 거치지 않는다. (이전 버전의 web 분기 제거됨)

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Copy, Loader2, Terminal, XCircle } from "lucide-react";

type CliState =
  | { kind: "trying" }       // localhost 자동 전달 시도 중
  | { kind: "auto-success" } // 자동 전달 성공
  | { kind: "manual" };      // 자동 실패 — 수동 복사 fallback

const CLI_CALLBACK_TIMEOUT_MS = 3000;

function CompleteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = searchParams.get("mode") ?? "web";
  const code = searchParams.get("code") ?? "";
  const cliPort = searchParams.get("cli_port") ?? "";
  const email = searchParams.get("email") ?? "";

  const [cliState, setCliState] = useState<CliState>({ kind: "trying" });
  const [copied, setCopied] = useState(false);

  // ── Web 모드로 이 페이지에 도달했다면 — 신 흐름에서는 platform-api 콜백이
  //    쿠키만 세팅하고 바로 `/` 로 리다이렉트해야 한다. 만약 어떤 이유로 이
  //    페이지에 도달하면 쿠키는 이미 세팅된 상태이므로 `/` 로 client-side
  //    redirect 만 해준다.
  useEffect(() => {
    if (mode !== "web") return;
    router.replace("/");
  }, [mode, router]);

  // ── CLI 모드 — localhost 자동 전달 시도 ──────────────
  useEffect(() => {
    if (mode !== "cli") return;
    if (!cliPort || !code) {
      setCliState({ kind: "manual" });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLI_CALLBACK_TIMEOUT_MS);

    fetch(`http://127.0.0.1:${cliPort}/callback?code=${encodeURIComponent(code)}`, {
      method: "GET",
      mode: "cors",
      signal: controller.signal,
    })
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setCliState({ kind: "auto-success" });
        } else {
          setCliState({ kind: "manual" });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setCliState({ kind: "manual" });
      })
      .finally(() => clearTimeout(timer));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [mode, cliPort, code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard API 불가 — textarea 선택으로 대체 */
    }
  };

  // ── 렌더 ─────────────────────────────────────────────

  if (mode === "web") {
    // useEffect 가 곧 redirect 시키지만, 한순간 보이는 placeholder.
    return (
      <Card>
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand mb-4" />
        <h1 className="font-heading text-lg font-semibold text-text-primary mb-2">
          홈으로 이동 중입니다...
        </h1>
      </Card>
    );
  }

  // mode=cli
  if (cliState.kind === "trying") {
    return (
      <Card>
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand mb-4" />
        <h1 className="font-heading text-lg font-semibold text-text-primary mb-2">
          터미널과 연결 중...
        </h1>
        <p className="text-sm text-text-secondary">
          로컬 포트 {cliPort} 로 인증 정보를 전달 중입니다.
        </p>
      </Card>
    );
  }

  if (cliState.kind === "auto-success") {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <h1 className="font-heading text-lg font-semibold text-text-primary mb-2">
          로그인 완료
        </h1>
        {email && <p className="text-xs text-text-muted mb-3">{email}</p>}
        <p className="text-sm text-text-secondary">
          터미널로 돌아가세요. 이 창은 닫아도 됩니다.
        </p>
      </Card>
    );
  }

  // manual fallback
  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-brand">LGAIR</span>
          <span className="font-heading text-2xl font-semibold text-text-primary">DataHub</span>
        </Link>
      </div>

      <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <XCircle className="h-6 w-6 text-amber-500 shrink-0" />
          <h1 className="font-heading text-lg font-semibold text-text-primary">
            자동 전달 실패 — 수동 입력 필요
          </h1>
        </div>

        <p className="text-sm text-text-secondary mb-4">
          터미널(localhost:{cliPort || "-"}) 로 자동 전달이 실패했습니다.
          아래 인증 code 를 복사해서 <strong>터미널 프롬프트</strong>에 붙여넣으세요.
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
          className="w-full bg-brand hover:bg-brand/90 text-white mb-2"
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
              code 복사
            </>
          )}
        </Button>

        <div className="mt-3 rounded-lg bg-bg-surface border border-dh-border p-3 text-xs text-text-secondary">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-3 w-3" />
            <span className="font-medium">터미널 안내</span>
          </div>
          <p>터미널에 "Paste code &gt;" 가 뜨면 Cmd/Ctrl+V 로 붙여넣으세요.</p>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          이 code 는 1회용이며 30분 내 사용해야 합니다.
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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-dh-border bg-white p-8 shadow-sm text-center">
        {children}
      </div>
    </div>
  );
}

export default function AuthCompletePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-surface px-4">
      <Suspense>
        <CompleteContent />
      </Suspense>
    </div>
  );
}
