import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getIssue, updateIssue } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ group: string; repo: string; issueNumber: string }>;

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo, issueNumber } = await params;

  try {
    const issue = await getIssue(token, `${group}/${repo}`, Number(issueNumber));
    return NextResponse.json(issue);
  } catch (err) {
    console.error("issue get error:", err);
    return NextResponse.json({ error: "Failed to fetch issue" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo, issueNumber } = await params;
  const body = await request.json();

  try {
    const issue = await updateIssue(token, `${group}/${repo}`, Number(issueNumber), body);
    return NextResponse.json(issue);
  } catch (err) {
    console.error("issue update error:", err);
    return NextResponse.json({ error: "Failed to update issue" }, { status: 500 });
  }
}
