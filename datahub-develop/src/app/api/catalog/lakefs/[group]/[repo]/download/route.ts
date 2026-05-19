import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getDownloadUrl } from "@/lib/platform-client";

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
  const path = sp.get("path") || "";
  const ref = sp.get("ref") || "main";

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const files = await getDownloadUrl(token, repoKey, ref, path);

    if (files.length === 0) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    return NextResponse.redirect(files[0].signed_url);
  } catch (err) {
    console.error("download error:", err);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
