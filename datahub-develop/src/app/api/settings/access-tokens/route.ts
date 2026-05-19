/**
 * BFF — `/api/settings/access-tokens`
 *
 * datahub-api 의 `/auth/access-tokens` 중 list / create 를 NextAuth
 * `platform_token` 쿠키 인증으로 proxy. revoke / rotate 는 `[ref]/route.ts`
 * 와 `[ref]/rotate/route.ts`.
 *
 * architecture/access-tokens.md §1.4.3 의 응답 코드 (401/403/404) 를 그대로
 * passthrough 하여 UI 가 분기할 수 있게 한다.
 *
 * 모든 호출은 BFF audit (`AuditLog` 테이블) 에 기록 — datahub-api 도달
 * 전 단계의 입력 검증 실패도 추적 가능.
 */

import { NextRequest, NextResponse } from "next/server";

import { startAudit } from "@/lib/audit";
import { getPlatformToken } from "@/lib/session";
import {
  AuthError,
  CreateAccessTokenParams,
  Grant,
  TokenType,
  UpstreamError,
  createAccessToken,
  listAccessTokens,
} from "@/lib/platform-client";

export const dynamic = "force-dynamic";

const VALID_TOKEN_TYPES: ReadonlySet<TokenType> = new Set<TokenType>([
  "read",
  "write",
  "fine_grained",
]);


export async function GET(request: NextRequest) {
  const audit = startAudit(request, "access_token_list", "access_token");

  const token = await getPlatformToken();
  if (!token) return audit.fail(401, "Unauthorized");

  const includeRevoked =
    request.nextUrl.searchParams.get("include_revoked") === "true";

  try {
    const tokens = await listAccessTokens(token, includeRevoked);
    return audit.ok(
      200,
      NextResponse.json({ access_tokens: tokens }),
    );
  } catch (err) {
    if (err instanceof AuthError) return audit.fail(401, "Unauthorized");
    if (err instanceof UpstreamError) {
      return audit.fail(err.status, err.detail || "Failed to list access tokens");
    }
    console.error("listAccessTokens error:", err);
    return audit.fail(500, "Failed to list access tokens");
  }
}


export async function POST(request: NextRequest) {
  const audit = startAudit(request, "access_token_create", "access_token");

  const token = await getPlatformToken();
  if (!token) return audit.fail(401, "Unauthorized");

  let body: {
    name?: unknown;
    token_type?: unknown;
    expires_in_days?: unknown;
    grants?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return audit.fail(400, "Invalid JSON body");
  }

  // ── 입력 검증 (BFF 1차) ─────────────────────────────────────────
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return audit.fail(400, "name is required");
  }
  if (name.length > 100) {
    return audit.fail(400, "name must be 100 characters or fewer");
  }

  const tokenTypeRaw =
    typeof body.token_type === "string" ? body.token_type : "";
  if (!VALID_TOKEN_TYPES.has(tokenTypeRaw as TokenType)) {
    return audit.fail(
      400,
      `token_type must be one of ${Array.from(VALID_TOKEN_TYPES).join(", ")}`,
    );
  }
  const token_type = tokenTypeRaw as TokenType;

  let expiresInDays: number | null = null;
  if (body.expires_in_days != null && body.expires_in_days !== "") {
    const n = Number(body.expires_in_days);
    if (!Number.isInteger(n) || n <= 0) {
      return audit.fail(400, "expires_in_days must be a positive integer");
    }
    expiresInDays = n;
  }

  let grants: Grant[] | undefined;
  if (token_type === "fine_grained") {
    if (!Array.isArray(body.grants) || body.grants.length === 0) {
      return audit.fail(400, "fine_grained token requires non-empty grants");
    }
    grants = body.grants.map((g): Grant => {
      const gg = g as { resource_type?: string; resource_id?: string | null; action?: string };
      return {
        resource_type: (gg.resource_type ?? "") as Grant["resource_type"],
        resource_id: gg.resource_id ?? null,
        action: (gg.action ?? "") as Grant["action"],
      };
    });
  } else if (Array.isArray(body.grants) && body.grants.length > 0) {
    return audit.fail(
      400,
      `${token_type} token does not accept explicit grants`,
    );
  }

  const params: CreateAccessTokenParams = {
    name,
    token_type,
    expires_in_days: expiresInDays,
    grants,
  };

  try {
    const created = await createAccessToken(token, params);
    return audit.ok(
      201,
      NextResponse.json(created, { status: 201 }),
      { resourceId: String(created.id) },
    );
  } catch (err) {
    if (err instanceof AuthError) return audit.fail(401, "Unauthorized");
    if (err instanceof UpstreamError) {
      return audit.fail(err.status, err.detail || "Failed to create access token");
    }
    console.error("createAccessToken error:", err);
    return audit.fail(500, "Failed to create access token");
  }
}
