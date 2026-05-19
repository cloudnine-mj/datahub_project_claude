import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { listBranches } from "@/lib/platform-client";

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
    const branches = await listBranches(token, repoKey);
    return NextResponse.json(
      branches.map((b) => ({
        id: b.name,
        commit_id: b.commit_id,
        commit_message: b.commit_message,
        commit_date: b.commit_date,
      })),
    );
  } catch (err) {
    console.error("branches error:", err);
    return NextResponse.json({ error: "Failed to list branches" }, { status: 500 });
  }
}
