/**
 * BFF — `GET /api/settings/access-tokens/autocomplete/groups?q=...`
 *
 * Access Token 위저드의 fine-grained 탭에서 사용자가 멤버인 그룹 (=
 * datahub-api 의 organization) 만 typeahead 으로 노출. 사용자의 platform_token
 * 으로 `GET /api/v1/organizations?search=q` 를 proxy.
 */

import { NextRequest, NextResponse } from "next/server";

import { startAudit } from "@/lib/audit";
import { getPlatformToken } from "@/lib/session";
import { AuthError, UpstreamError, listMyOrgs } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const audit = startAudit(
    request,
    "access_token_autocomplete_groups",
    "access_token",
  );

  const token = await getPlatformToken();
  if (!token) return audit.fail(401, "Unauthorized");

  const q = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const groups = await listMyOrgs(token, q);
    return audit.ok(200, NextResponse.json({ groups }));
  } catch (err) {
    if (err instanceof AuthError) return audit.fail(401, "Unauthorized");
    if (err instanceof UpstreamError) {
      return audit.fail(err.status, err.detail || "Failed to list groups");
    }
    console.error("listMyOrgs error:", err);
    return audit.fail(500, "Failed to list groups");
  }
}
