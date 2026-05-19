import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";

const PLATFORM_API_URL =
  process.env.PLATFORM_API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ||
  "http://localhost:8643";

export const dynamic = "force-dynamic";

/**
 * 쿠키의 Domain 속성 결정.
 * platform-api 가 `.datahub.lgair-data.com` 같은 공유 도메인으로 쿠키를
 * 세팅하므로, 삭제할 때도 같은 Domain 을 지정해야 브라우저가 매칭해 지운다.
 * 요청의 Host 헤더(또는 X-Forwarded-Host)에서 서브도메인을 떼고 `.`prefix 로
 * 부모 도메인을 만든다. localhost / IP 는 host-only 로 두고 Domain 생략.
 */
function deriveCookieDomain(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  if (explicit) return explicit;

  const h = headers();
  const rawHost = h.get("x-forwarded-host") ?? h.get("host");
  if (!rawHost) return undefined;
  const hostname = rawHost.split(":")[0];
  // localhost / IP 는 host-only
  if (!hostname.includes(".") || /^[\d.]+$/.test(hostname)) return undefined;
  const parts = hostname.split(".");
  if (parts.length < 2) return undefined;
  return "." + parts.slice(1).join(".");
}

export async function POST() {
  const jar = cookies();
  const token = jar.get("platform_token")?.value;

  if (token) {
    await fetch(`${PLATFORM_API_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      // 서버 측 revoke 실패해도 클라이언트 쿠키는 계속 정리
    });
  }

  const res = NextResponse.json({ ok: true });
  const domain = deriveCookieDomain();
  const base = { path: "/", maxAge: 0, ...(domain ? { domain } : {}) };
  res.cookies.set("platform_token", "", base);
  res.cookies.set("platform_refresh_token", "", base);
  return res;
}
