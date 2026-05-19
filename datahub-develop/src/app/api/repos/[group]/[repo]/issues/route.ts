import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { listIssues, createIssue } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string }>;

export async function GET(request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const { searchParams } = new URL(request.url);
  const state = (searchParams.get("state") as "open" | "closed" | "all") ?? "open";
  const label = searchParams.get("label") ?? undefined;
  const page = Number(searchParams.get("page") ?? 1);
  const per_page = Number(searchParams.get("per_page") ?? 25);

  try {
    const data = await listIssues(token, `${group}/${repo}`, { state, label, page, per_page });
    return NextResponse.json(data);
  } catch (err) {
    console.error("issues list error:", err);
    return NextResponse.json({ error: "Failed to fetch issues" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const body = await request.json();

  try {
    const issue = await createIssue(token, `${group}/${repo}`, body);
    return NextResponse.json(issue, { status: 201 });
  } catch (err) {
    console.error("issue create error:", err);
    return NextResponse.json({ error: "Failed to create issue" }, { status: 500 });
  }
}
