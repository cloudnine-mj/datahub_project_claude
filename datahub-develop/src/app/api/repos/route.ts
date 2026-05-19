import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { listRepos, createRepo } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const repos = await listRepos(token);
    return NextResponse.json({ repos });
  } catch (err) {
    console.error("repos list error:", err);
    return NextResponse.json({ error: "Failed to list repos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  if (!body.repo_name?.trim()) {
    return NextResponse.json({ error: "repo_name is required" }, { status: 400 });
  }

  // visibility validation (governance §Formal Model)
  const allowedVisibility = ["public", "private", "fine_grained"] as const;
  if (
    body.visibility !== undefined &&
    !allowedVisibility.includes(body.visibility)
  ) {
    return NextResponse.json(
      {
        error:
          "visibility must be one of 'public', 'private', 'fine_grained'.",
      },
      { status: 400 },
    );
  }
  if (body.visibility === "fine_grained" && !body.public_access) {
    return NextResponse.json(
      { error: "fine_grained visibility requires public_access" },
      { status: 400 },
    );
  }

  try {
    const result = await createRepo(token, {
      repo_name: body.repo_name.trim(),
      description: body.description ?? undefined,
      repo_type: body.repo_type ?? undefined,
      group: body.group ?? undefined,
      visibility: body.visibility ?? undefined,
      public_access: body.public_access ?? undefined,
      ai_card: body.ai_card ?? false,
      ai_metadata: body.ai_metadata ?? false,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    // backend 4xx 는 detail 그대로 passthrough (governance/access-token 패턴 동일)
    const anyErr = err as { status?: number; detail?: unknown; message?: string };
    if (typeof anyErr?.status === "number" && anyErr.status >= 400 && anyErr.status < 500) {
      return NextResponse.json(
        { error: anyErr.detail ?? anyErr.message ?? "Bad request" },
        { status: anyErr.status },
      );
    }
    console.error("repo create error:", err);
    return NextResponse.json({ error: "Failed to create repo" }, { status: 500 });
  }
}
