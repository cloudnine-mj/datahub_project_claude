/**
 * BFF — `DELETE /api/settings/access-tokens/[ref]`
 *
 * `ref` 는 토큰의 숫자 id 또는 prefix (`dh_...` / `dl_...`).
 * datahub-api 의 `DELETE /auth/access-tokens/{ref}` 로 proxy. 멱등.
 */

import { NextRequest, NextResponse } from "next/server";

import { startAudit } from "@/lib/audit";
import { getPlatformToken } from "@/lib/session";
import { AuthError, UpstreamError, revokeAccessToken } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { ref: string } },
) {
  const audit = startAudit(request, "access_token_revoke", "access_token");

  const token = await getPlatformToken();
  if (!token) {
    return audit.fail(401, "Unauthorized", { resourceId: params.ref });
  }

  try {
    const result = await revokeAccessToken(token, params.ref);
    return audit.ok(200, NextResponse.json(result), {
      resourceId: params.ref,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return audit.fail(401, "Unauthorized", { resourceId: params.ref });
    }
    if (err instanceof UpstreamError) {
      return audit.fail(err.status, err.detail || "Failed to revoke access token", {
        resourceId: params.ref,
      });
    }
    console.error("revokeAccessToken error:", err);
    return audit.fail(500, "Failed to revoke access token", {
      resourceId: params.ref,
    });
  }
}
