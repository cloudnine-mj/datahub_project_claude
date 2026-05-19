import { NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getRepo, deleteRepo } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;

  try {
    const data = await getRepo(token, repo);
    return NextResponse.json(data);
  } catch (err: any) {
    const status = err?.status === 404 ? 404 : 500;
    return NextResponse.json({ error: "Failed to fetch repo" }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;

  try {
    await deleteRepo(token, repo);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("repo delete error:", err);
    return NextResponse.json({ error: "Failed to delete repo" }, { status: 500 });
  }
}
