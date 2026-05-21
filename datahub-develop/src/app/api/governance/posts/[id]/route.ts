/**
 * GET    /api/governance/posts/[id]
 * PATCH  /api/governance/posts/[id]   — 작성자 본인 또는 admin
 * DELETE /api/governance/posts/[id]   — 작성자 본인 또는 admin
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_post_get", "governance_post");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const post = await prisma.governancePost.findUnique({
    where: { id: params.id },
    include: {
      attachments: { select: { id: true, filename: true, sizeBytes: true } },
    },
  });
  if (!post) return audit.fail(404, "post not found", { resourceId: params.id });
  if (post.visibility === "admin" && !auth.isAdmin) {
    return audit.fail(404, "post not found", { resourceId: params.id });
  }
  return audit.ok(200, NextResponse.json(post), { resourceId: post.id });
}

interface PostUpdateBody {
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

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_post_update", "governance_post");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const post = await prisma.governancePost.findUnique({ where: { id: params.id } });
  if (!post) return audit.fail(404, "post not found", { resourceId: params.id });
  if (post.authorId !== auth.dbUser.id && !auth.isAdmin) {
    return audit.fail(403, "수정 권한이 없습니다.");
  }

  let body: PostUpdateBody;
  try {
    body = (await request.json()) as PostUpdateBody;
  } catch {
    return audit.fail(400, "invalid JSON body");
  }

  const updated = await prisma.governancePost.update({
    where: { id: post.id },
    data: {
      title: body.title ?? post.title,
      docNo: body.doc_no ?? post.docNo,
      docType: body.doc_type ?? post.docType,
      category: body.category ?? post.category,
      content: body.content ?? post.content,
      isDraft: body.is_draft ?? post.isDraft,
      visibility: body.visibility ?? post.visibility,
      summary: body.summary ?? post.summary,
      tags:
        body.tags === null
          ? Prisma.JsonNull
          : ((body.tags ?? post.tags ?? undefined) as Prisma.InputJsonValue | undefined),
      severity: body.severity ?? post.severity,
      appliesTo: body.applies_to ?? post.appliesTo,
      tldr: body.tldr ?? post.tldr,
      actionItems:
        body.action_items === null
          ? Prisma.JsonNull
          : ((body.action_items ?? post.actionItems ?? undefined) as Prisma.InputJsonValue | undefined),
      examples: body.examples ?? post.examples,
    },
  });

  return audit.ok(200, NextResponse.json(updated), { resourceId: updated.id });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_post_delete", "governance_post");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const post = await prisma.governancePost.findUnique({ where: { id: params.id } });
  if (!post) return audit.fail(404, "post not found", { resourceId: params.id });
  if (post.authorId !== auth.dbUser.id && !auth.isAdmin) {
    return audit.fail(403, "삭제 권한이 없습니다.");
  }

  await prisma.governancePost.delete({ where: { id: post.id } });
  return audit.ok(204, new NextResponse(null, { status: 204 }), {
    resourceId: post.id,
  });
}
