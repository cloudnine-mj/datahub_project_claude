/**
 * DELETE /api/governance/forms/[id]/comments/[commentId] — 본인 또는 admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string; commentId: string };
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_comment_delete", "governance_form_comment");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const comment = await prisma.governanceFormComment.findFirst({
    where: { id: params.commentId, formId: params.id },
  });
  if (!comment) return audit.fail(404, "comment not found", { resourceId: params.commentId });
  if (comment.authorId !== auth.dbUser.id && !auth.isAdmin) {
    return audit.fail(403, "삭제 권한이 없습니다.");
  }
  await prisma.governanceFormComment.delete({ where: { id: comment.id } });
  return audit.ok(204, new NextResponse(null, { status: 204 }), { resourceId: comment.id });
}
