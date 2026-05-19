import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { listIssueComments, createIssueComment } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string; issueNumber: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo, issueNumber } = await params;

  try {
    const comments = await listIssueComments(token, `${group}/${repo}`, Number(issueNumber));
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("comments list error:", err);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo, issueNumber } = await params;
  const { body } = await request.json();

  try {
    const comment = await createIssueComment(
      token,
      `${group}/${repo}`,
      Number(issueNumber),
      body,
    );
    return NextResponse.json(comment, { status: 201 });
  } catch (err) {
    console.error("comment create error:", err);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
