import { redirect } from "next/navigation";
import { headers } from "next/headers";

// 브라우저 리다이렉트이므로 외부 URL 사용
// Fallback 은 prd 도메인. 빌드 시 NEXT_PUBLIC_PLATFORM_API_URL 로 환경별 override.
const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL || "https://api.datahub.lgair-data.com";

function getPublicOrigin(request: Request): string {
  // Next.js server 는 0.0.0.0:3000 에 바인딩되어 있어 `request.url` 의 origin
  // 이 내부 URL 을 가리킨다. ingress-nginx 가 세팅한 X-Forwarded-* 헤더를
  // 우선 사용하고, 없으면 Host 헤더 → 마지막 대안으로 request.url 을 쓴다.
  const h = headers();
  const forwardedHost = h.get("x-forwarded-host") ?? h.get("host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawRedirect = url.searchParams.get("redirect_uri") || "/";

  const absoluteRedirect = rawRedirect.startsWith("http")
    ? rawRedirect
    : `${getPublicOrigin(request)}${rawRedirect}`;

  redirect(
    `${PLATFORM_API_URL}/api/v1/auth/login?redirect_uri=${encodeURIComponent(absoluteRedirect)}`,
  );
}
