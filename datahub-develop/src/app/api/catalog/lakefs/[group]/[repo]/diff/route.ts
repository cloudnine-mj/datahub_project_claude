import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getDiff } from "@/lib/platform-client";

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
  const fromRef = sp.get("from_ref") || "main";
  const toRef = sp.get("to_ref") || "main";

  try {
    const entries = await getDiff(token, repoKey, fromRef, toRef);
    return NextResponse.json(entries);
  } catch (err) {
    console.error("diff error:", err);
    return NextResponse.json({ error: "Failed to fetch diff" }, { status: 500 });
  }
}
