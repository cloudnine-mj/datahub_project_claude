/**
 * GET  /api/governance/posts?board=policy|process  — 게시판 목록
 * POST /api/governance/posts                       — 게시글 작성 (admin)
 *
 * datahub-web `app/api/routes/posts.py` 의 list_posts / create_post 포팅.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

const BOARD_TYPES = new Set(["policy", "process"]);
const VISIBILITY_VALUES = new Set(["public", "admin"]);
const SEVERITY_VALUES = new Set(["low", "medium", "high", "critical"]);

export async function GET(request: NextRequest) {
  const audit = startAudit(request, "governance_post_list", "governance_post");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const { searchParams } = request.nextUrl;
  const boardType = searchParams.get("board");
  const mine = searchParams.get("mine") === "true";

  if (!boardType || !BOARD_TYPES.has(boardType)) {
    return audit.fail(400, "board parameter required: policy|process");
  }

  const where: { boardType: string; authorId?: string; visibility?: string } = {
    boardType,
  };
  if (mine) where.authorId = auth.dbUser.id;
  // 비-admin 은 visibility='admin' 행 제외
  if (!auth.isAdmin) where.visibility = "public";

  const posts = await prisma.governancePost.findMany({
    where,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  return audit.ok(200, NextResponse.json(posts));
}

interface PostCreateBody {
  board_type?: string;
  title?: string;
  doc_no?: string | null;
  doc_type?: string | null;
  category?: string | null;
  content?: string;
  is_draft?: boolean;
  visibility?: string;
  author_name?: string;
  summary?: string | null;
  tags?: string[] | null;
  severity?: string | null;
  applies_to?: string | null;
  tldr?: string | null;
  action_items?: string[] | null;
  examples?: string | null;
}

export async function POST(request: NextRequest) {
  const audit = startAudit(request, "governance_post_create", "governance_post");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  // 게시글 작성은 admin 만 (datahub-web 컨벤션과 동일)
  if (!auth.isAdmin) return audit.fail(403, "관리자만 게시글을 작성할 수 있습니다.");

  let body: PostCreateBody;
  try {
    body = (await request.json()) as PostCreateBody;
  } catch {
    return audit.fail(400, "invalid JSON body");
  }

  const boardType = body.board_type ?? "";
  if (!BOARD_TYPES.has(boardType)) {
    return audit.fail(400, `unknown board_type: ${boardType}`);
  }
  const title = (body.title ?? "").trim();
  if (!title) return audit.fail(400, "title is required");

  const visibility = body.visibility ?? "public";
  if (!VISIBILITY_VALUES.has(visibility)) {
    return audit.fail(400, `unknown visibility: ${visibility}`);
  }
  if (body.severity && !SEVERITY_VALUES.has(body.severity)) {
    return audit.fail(400, `unknown severity: ${body.severity}`);
  }

  const created = await prisma.governancePost.create({
    data: {
      boardType,
      title,
      docNo: body.doc_no ?? null,
      docType: body.doc_type ?? null,
      category: body.category ?? null,
      content: body.content ?? "",
      isDraft: body.is_draft ?? false,
      visibility,
      authorId: auth.dbUser.id,
      authorName: body.author_name ?? auth.dbUser.name ?? auth.session.user.email,
      // 정책 메타 — boardType==policy 일 때만 사용. process 는 null.
      summary: body.summary ?? null,
      tags: body.tags ?? undefined,
      severity: body.severity ?? null,
      appliesTo: body.applies_to ?? null,
      tldr: body.tldr ?? null,
      actionItems: body.action_items ?? undefined,
      examples: body.examples ?? null,
    },
  });

  return audit.ok(201, NextResponse.json(created), { resourceId: created.id });
}
