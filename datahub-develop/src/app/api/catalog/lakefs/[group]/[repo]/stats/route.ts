import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getRepoStats } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ group: string; repo: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const repoKey = `${group}/${repo}`;

  try {
    const stats = await getRepoStats(token, repoKey);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("stats error:", err);
    return NextResponse.json({ error: "Failed to fetch repo stats" }, { status: 500 });
  }
}
