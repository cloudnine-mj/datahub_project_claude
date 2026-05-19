import { NextResponse, type NextRequest } from "next/server";

export default function middleware(req: NextRequest) {
  // Local-dev only — datahub-api 없이 라우트 보호 우회. 운영에서 절대 사용 X.
  if (process.env.DEV_AUTH_BYPASS === "1") {
    return NextResponse.next();
  }
  const token = req.cookies.get("platform_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // public (non-auth) 경로들
    //   api/auth              : 로그인/로그아웃/콜백/me 엔드포인트
    //   login                 : 로그인 진입 페이지
    //   auth/complete         : 통합 완료 페이지 (cli / paste 용 — web 분기 제거됨)
    //   auth/device           : CLI device flow 승인 페이지
    //   auth/device-success   : CLI device flow 완료 페이지
    //   auth/paste            : CLI paste 모드 완료 페이지
    //   auth/sso-authenticating : SSO 대기 페이지
    //   _next/static, _next/image, favicon.ico, $ : Next.js 내부/홈
    "/((?!api/auth|login|auth/complete|auth/device|auth/device-success|auth/paste|auth/sso-authenticating|_next/static|_next/image|favicon.ico|$).*)",
  ],
};
