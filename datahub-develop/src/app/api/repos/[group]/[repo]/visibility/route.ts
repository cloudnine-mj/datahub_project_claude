import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { updateRepoVisibility } from "@/lib/platform-client";
import type { VisibilityMode, PublicAccess } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string }>;

const VALID_VISIBILITY: readonly VisibilityMode[] = [
  "public",
  "private",
  "fine_grained",
] as const;

/**
 * PATCH /api/repos/{group}/{repo}/visibility
 *
 * governance source-of-truth:
 *   docs/dev_docs/api-specs/repository-api-spec.md §Visibility update
 *   docs/dev_docs/product-specs/repository-visibility-policy.md
 *
 * Body:
 *   { visibility: "public" | "private" | "fine_grained",
 *     version: number,
 *     public_access?: PublicAccess  // fine_grained 일 때 필수 }
 *
 * version 은 직전 GET 응답의 policy version. backend 가 mismatch 시 409.
 */
export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const body = await request.json();

  if (!VALID_VISIBILITY.includes(body.visibility)) {
    return NextResponse.json(
      {
        error:
          "visibility must be one of 'public', 'private', 'fine_grained'.",
      },
      { status: 400 },
    );
  }
  if (typeof body.version !== "number" || body.version < 1) {
    return NextResponse.json(
      { error: "version is required (number, ≥1)" },
      { status: 400 },
    );
  }
  if (body.visibility === "fine_grained" && !body.public_access) {
    return NextResponse.json(
      { error: "fine_grained visibility requires public_access" },
      { status: 400 },
    );
  }

  try {
    const result = await updateRepoVisibility(
      token,
      `${group}/${repo}`,
      body.visibility as VisibilityMode,
      body.version,
      body.public_access as PublicAccess | undefined,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // backend 4xx (409 conflict, 400 validation 등) 는 detail 그대로 passthrough.
    const anyErr = err as { status?: number; detail?: unknown; message?: string };
    if (
      typeof anyErr?.status === "number" &&
      anyErr.status >= 400 &&
      anyErr.status < 500
    ) {
      return NextResponse.json(
        { error: anyErr.detail ?? anyErr.message ?? "Bad request" },
        { status: anyErr.status },
      );
    }
    console.error("visibility update error:", err);
    return NextResponse.json({ error: "Failed to update visibility" }, { status: 500 });
  }
}
