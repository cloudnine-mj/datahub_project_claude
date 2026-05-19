import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { listFiles } from "@/lib/platform-client";
import { buildFileTree } from "@/lib/catalog-types";
import type { LakeFSObject } from "@/lib/catalog-types";

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
  const prefix = sp.get("prefix") || "";
  const ref = sp.get("ref") || "main";

  try {
    const data = await listFiles(token, repoKey, ref, prefix, true);

    const objects: LakeFSObject[] = data.items.map((item) => ({
      path: item.path,
      path_type: item.path_type as "object" | "common_prefix",
      size_bytes: item.size_bytes ?? undefined,
      mtime: item.mtime ?? undefined,
    }));

    const tree = buildFileTree(objects, prefix);
    return NextResponse.json(tree);
  } catch (err) {
    console.error("files error:", err);
    return NextResponse.json({ error: "Failed to list files" }, { status: 500 });
  }
}
