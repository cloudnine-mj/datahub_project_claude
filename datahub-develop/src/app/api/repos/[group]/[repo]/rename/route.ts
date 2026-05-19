/**
 * BFF: PATCH rename a repository slug (governance §repo-identity-spec).
 *
 * 클라이언트는 navigate.replace(new_path) 로 화면 갱신.
 */
import { NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { renameRepo } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string }>;

export async function PATCH(request: Request, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;

  const body = await request.json().catch(() => ({}));
  const newName = String(body?.new_name || "").trim();
  if (!newName) {
    return NextResponse.json({ error: "new_name is required" }, { status: 400 });
  }
  const reason = body?.reason ? String(body.reason) : undefined;

  try {
    const result = await renameRepo(token, `${group}/${repo}`, newName, reason);
    return NextResponse.json(result);
  } catch (err: any) {
    const status = err?.status ?? 500;
    return NextResponse.json(
      { error: err?.detail ?? "Failed to rename repo" },
      { status },
    );
  }
}
