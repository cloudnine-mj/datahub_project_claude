/**
 * BFF: GET /_resolve/repos/{group}/{repo} — rename history lookup.
 *
 * 404 발생 시 페이지가 호출 → redirected=true 면 canonical 경로로 router.replace.
 */
import { NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { resolveRepoPath } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;

  try {
    const data = await resolveRepoPath(token, group, repo);
    return NextResponse.json(data);
  } catch (err: any) {
    const status = err?.status === 404 ? 404 : 500;
    return NextResponse.json(
      { error: err?.detail ?? "Resolve failed" },
      { status },
    );
  }
}
