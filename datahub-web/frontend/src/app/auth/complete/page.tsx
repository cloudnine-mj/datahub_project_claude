"use client";

/**
 * 인증 처리 페이지 — 스토리보드 E7DYy.
 *
 * 두 가지 케이스:
 *  1) `mode=cli` + `code` — datahub-python-develop SDK 의 paste mode 콜백.
 *     사용자가 code 를 복사해 CLI 터미널에 붙여넣음.
 *  2) (web flow) 사실 plat-api 는 web 로그인 시 이 페이지를 거치지 않고
 *     state(원래 URL)로 직통 redirect — 이 페이지가 잠깐 보일 일 거의 없음.
 *     그래도 fallback 으로 짧은 로딩 후 / 로 이동.
 */

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Copy } from "lucide-react";

export default function AuthCompletePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const mode = sp?.get("mode");
  const code = sp?.get("code");
  const cliPort = sp?.get("cli_port");
  const [copied, setCopied] = useState(false);

  // CLI 모드: localhost callback 시도. 실패 시 code 를 UI 에 노출 (paste fallback).
  useEffect(() => {
    if (mode !== "cli" || !code || !cliPort) return;
    fetch(`http://localhost:${cliPort}/callback?code=${encodeURIComponent(code)}`)
      .then(() => {
        // SDK 가 받았으면 사용자에게 종료 안내만 표시 (자동 닫기는 못 하지만)
      })
      .catch(() => {
        /* CORS / 포트 미열림 — UI 의 code 복사 fallback 활성 */
      });
  }, [mode, code, cliPort]);

  // Web flow fallback — 잠깐 로딩 후 홈으로 (plat-api 가 보통 직접 redirect 함)
  useEffect(() => {
    if (mode === "cli") return;
    const t = setTimeout(() => router.push("/"), 800);
    return () => clearTimeout(t);
  }, [mode, router]);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 권한 없음 — 사용자가 수동 선택 */
    }
  }

  // CLI paste mode 화면
  if (mode === "cli" && code) {
    return (
      <Shell>
        <div className="text-center">
          <h2 className="text-2xl font-semibold">CLI 인증 코드</h2>
          <p className="mt-2 text-sm text-gray-500">
            아래 코드를 복사해 터미널에 붙여넣으세요. 자동 전달이 성공했다면 이 페이지는 닫아도 됩니다.
          </p>

          <div className="mt-6 flex items-center gap-2">
            <code className="block flex-1 truncate rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-left font-mono text-xs text-gray-700">
              {code}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
            >
              <Copy size={14} /> {copied ? "복사됨" : "복사"}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // 일반 인증 처리 중 (스토리보드 화면 2)
  return (
    <Shell>
      <div className="grid h-[100px] w-[100px] place-items-center rounded-full border border-gray-100 bg-white">
        <Loader2 size={48} className="animate-spin text-gray-400" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold tracking-tight">SSO 인증 중...</h2>
      <p className="mt-2 text-center text-sm text-gray-500">
        회사 계정으로 자동 로그인하고 있습니다. 잠시만 기다려주세요.
      </p>
      <div className="mt-6 h-1 w-[200px] overflow-hidden rounded-full bg-gray-100">
        <div className="h-full w-[60%] animate-pulse rounded-full bg-blue-500" />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex h-14 items-center border-b border-gray-100 px-6">
        <div className="flex items-center gap-2">
          <span className="block h-3 w-3 rounded-sm bg-brand" />
          <span className="text-base font-bold tracking-tight">LGAIR DataHub</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6">{children}</main>
      <footer className="flex h-12 items-center justify-between border-t border-gray-100 px-6 text-xs text-gray-400">
        <span>© 2025 LG Electronics</span>
      </footer>
    </div>
  );
}
