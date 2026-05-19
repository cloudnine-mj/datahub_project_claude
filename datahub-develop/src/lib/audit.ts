/**
 * BFF / Web audit 헬퍼.
 *
 * 모든 BFF route 의 호출 결과 (성공 / 실패) 를 `AuditLog` 테이블에 기록.
 * datahub-api 의 audit 과 별개로 BFF 자체에서 일어나는 입력 검증 실패 /
 * 네트워크 에러 / 사용자 인증 누락도 모두 추적 가능.
 *
 * 사용 패턴:
 *
 *     export async function POST(request: NextRequest) {
 *       const audit = startAudit(request, "access_token_create", "access_token");
 *       const token = await getPlatformToken();
 *       if (!token) return audit.fail(401, "Unauthorized");
 *
 *       try {
 *         const created = await createAccessToken(token, params);
 *         return audit.ok(201, NextResponse.json(created), {
 *           resourceId: String(created.id),
 *         });
 *       } catch (err) {
 *         if (err instanceof UpstreamError) {
 *           return audit.fail(err.status, err.detail);
 *         }
 *         return audit.fail(500, String(err));
 *       }
 *     }
 *
 * 보안 — raw token 등 민감 값을 ``detail`` 에 절대 포함시키지 않는다.
 * 기록 실패는 swallow (응답 자체가 실패하면 안 됨).
 */

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const MAX_DETAIL_LENGTH = 2000;

interface AuditMeta {
  resourceId?: string | null;
  userEmail?: string | null;
}

export interface AuditHandle {
  ok(status: number, response: NextResponse, meta?: AuditMeta): NextResponse;
  fail(status: number, detail: string, meta?: AuditMeta): NextResponse;
}

function clipDetail(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).replace(/dh_[A-Za-z0-9_-]+/g, "dh_***redacted***");
  return s.length > MAX_DETAIL_LENGTH ? s.slice(0, MAX_DETAIL_LENGTH) + "…" : s;
}

function clientIp(request: NextRequest): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip");
}

async function record(args: {
  userEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  route: string;
  status: number;
  outcome: "success" | "failure";
  detail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userEmail: args.userEmail,
        action: args.action,
        resourceType: args.resourceType,
        resourceId: args.resourceId,
        route: args.route,
        status: args.status,
        outcome: args.outcome,
        detail: clipDetail(args.detail),
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
      },
    });
  } catch (err) {
    // audit 기록 실패는 응답에 영향 주지 않음
    console.error("audit record failed:", err);
  }
}

/**
 * BFF route handler 에 부착하는 audit handle.
 *
 * 본 함수는 NextAuth session 을 1회 lookup 해 user email 을 캐싱한다.
 * 인증 전 단계의 호출은 userEmail=null 로 기록.
 */
export function startAudit(
  request: NextRequest,
  action: string,
  resourceType: string | null = null,
): AuditHandle {
  const route = `${request.method} ${request.nextUrl.pathname}`;
  const ip = clientIp(request);
  const ua = request.headers.get("user-agent");

  // session lookup 은 best-effort — 실패해도 audit 기록은 진행
  const sessionPromise = getSession()
    .then((s) => s?.user?.email ?? null)
    .catch(() => null);

  const finalize = async (
    status: number,
    outcome: "success" | "failure",
    detail: string | null,
    meta?: AuditMeta,
  ): Promise<void> => {
    const sessionEmail = await sessionPromise;
    await record({
      userEmail: meta?.userEmail ?? sessionEmail,
      action,
      resourceType,
      resourceId: meta?.resourceId ?? null,
      route,
      status,
      outcome,
      detail,
      ipAddress: ip,
      userAgent: ua,
    });
  };

  return {
    ok(status, response, meta) {
      // fire-and-forget — 응답 지연 방지
      void finalize(status, "success", null, meta);
      return response;
    },
    fail(status, detail, meta) {
      void finalize(status, "failure", detail, meta);
      return NextResponse.json({ error: detail }, { status });
    },
  };
}
