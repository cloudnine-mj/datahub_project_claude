import { NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { revokePermission } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string; email: string }>;

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo, email } = await params;

  try {
    await revokePermission(token, `${group}/${repo}`, decodeURIComponent(email));
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("permission revoke error:", err);
    return NextResponse.json({ error: "Failed to revoke permission" }, { status: 500 });
  }
}
