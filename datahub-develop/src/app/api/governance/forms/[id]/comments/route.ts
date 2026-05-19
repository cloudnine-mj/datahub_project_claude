/**
 * GET / POST /api/governance/forms/[id]/comments — HuggingFace 형태 댓글 스레드.
 */
import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_comment_list", "governance_form_comment");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const form = await prisma.governanceForm.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  const comments = await prisma.governanceFormComment.findMany({
    where: { formId: form.id },
    orderBy: { createdAt: "asc" },
  });
  return audit.ok(200, NextResponse.json(comments));
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_comment_create", "governance_form_comment");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  let body: { body?: string };
  try {
    body = (await request.json()) as { body?: string };
  } catch {
    return audit.fail(400, "invalid JSON body");
  }
  const text = (body.body ?? "").trim();
  if (!text) return audit.fail(400, "댓글 본문을 입력하세요.");

  const form = await prisma.governanceForm.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  const created = await prisma.governanceFormComment.create({
    data: {
      formId: form.id,
      authorId: auth.dbUser.id,
      authorName: auth.dbUser.name ?? auth.session.user.email,
      authorRole: auth.isAdmin ? "admin" : "viewer",
      body: text,
    },
  });
  return audit.ok(201, NextResponse.json(created), { resourceId: created.id });
}
