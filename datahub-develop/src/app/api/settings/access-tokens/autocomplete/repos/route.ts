/**
 * BFF — `GET /api/settings/access-tokens/autocomplete/repos?q=...`
 *
 * Access Token 위저드의 fine-grained 탭에서 사용자가 권한 보유한 repo 만
 * typeahead 으로 노출하기 위한 자동완성 endpoint. 사용자의 platform_token 으로
 * `GET /api/v1/repos` 를 proxy — datahub-api 가 본인 접근 가능 repo 만 반환.
 *
 * `q` 쿼리는 BFF / 클라이언트 측에서 부분 매칭 필터.
 */

import { NextRequest, NextResponse } from "next/server";

import { startAudit } from "@/lib/audit";
import { getPlatformToken } from "@/lib/session";
import { AuthError, UpstreamError, listMyRepos } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const audit = startAudit(
    request,
    "access_token_autocomplete_repos",
    "access_token",
  );

  const token = await getPlatformToken();
  if (!token) return audit.fail(401, "Unauthorized");

  const q = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const repos = await listMyRepos(token, q);
    return audit.ok(200, NextResponse.json({ repos }));
  } catch (err) {
    if (err instanceof AuthError) return audit.fail(401, "Unauthorized");
    if (err instanceof UpstreamError) {
      return audit.fail(err.status, err.detail || "Failed to list repos");
    }
    console.error("listMyRepos error:", err);
    return audit.fail(500, "Failed to list repos");
  }
}
