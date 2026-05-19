import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getCommitLog } from "@/lib/platform-client";
import type { CommitInfo } from "@/lib/catalog-types";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ group: string; repo: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const repoKey = `${group}/${repo}`;
  const sp = request.nextUrl.searchParams;
  const ref = sp.get("ref") || "main";
  const amount = parseInt(sp.get("amount") || "30", 10);

  try {
    const commits = await getCommitLog(token, repoKey, ref, amount);

    const result: CommitInfo[] = commits.map((c) => ({
      id: c.id,
      shortId: c.id.slice(0, 8),
      message: c.message,
      userEmail: c.metadata?.["user_email"] || c.committer,
      date: c.creation_date
        ? new Date(c.creation_date * 1000).toISOString()
        : new Date().toISOString(),
      isMerge: c.parents.length > 1,
      parents: c.parents,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("commits error:", err);
    return NextResponse.json({ error: "Failed to fetch commit log" }, { status: 500 });
  }
}
