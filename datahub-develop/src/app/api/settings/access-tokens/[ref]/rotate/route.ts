/**
 * BFF — `POST /api/settings/access-tokens/[ref]/rotate`
 *
 * 기존 토큰을 revoke + 동일 grants/name/type/expires 로 새 토큰 발급. atomic.
 * 응답에 ``access_token`` (raw) 가 1회 노출.
 */

import { NextRequest, NextResponse } from "next/server";

import { startAudit } from "@/lib/audit";
import { getPlatformToken } from "@/lib/session";
import { AuthError, UpstreamError, rotateAccessToken } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { ref: string } },
) {
  const audit = startAudit(request, "access_token_rotate", "access_token");

  const token = await getPlatformToken();
  if (!token) {
    return audit.fail(401, "Unauthorized", { resourceId: params.ref });
  }

  try {
    const created = await rotateAccessToken(token, params.ref);
    return audit.ok(200, NextResponse.json(created), {
      resourceId: String(created.id),
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return audit.fail(401, "Unauthorized", { resourceId: params.ref });
    }
    if (err instanceof UpstreamError) {
      return audit.fail(err.status, err.detail || "Failed to rotate access token", {
        resourceId: params.ref,
      });
    }
    console.error("rotateAccessToken error:", err);
    return audit.fail(500, "Failed to rotate access token", {
      resourceId: params.ref,
    });
  }
}
