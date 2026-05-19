import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { listPermissions, grantPermission } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;

  try {
    const permissions = await listPermissions(token, `${group}/${repo}`);
    return NextResponse.json({ permissions });
  } catch (err) {
    console.error("permissions list error:", err);
    return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const body = await request.json();

  if (!body.email || !body.role) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  try {
    await grantPermission(token, `${group}/${repo}`, body.email, body.role);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("permission grant error:", err);
    return NextResponse.json({ error: "Failed to grant permission" }, { status: 500 });
  }
}
