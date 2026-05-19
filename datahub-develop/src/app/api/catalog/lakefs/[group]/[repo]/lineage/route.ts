import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getRepoLineage, createLineage } from "@/lib/platform-client";

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
    const lineage = await getRepoLineage(token, repoKey);
    return NextResponse.json(lineage);
  } catch (err) {
    console.error("lineage error:", err);
    return NextResponse.json({ error: "Failed to fetch lineage" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ group: string; repo: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const repoKey = `${group}/${repo}`;
  const body = await request.json();

  try {
    const entry = await createLineage(
      token,
      repoKey,
      body.source_repo,
      body.relation_type,
      body.description,
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error("create lineage error:", err);
    return NextResponse.json({ error: "Failed to create lineage" }, { status: 500 });
  }
}
