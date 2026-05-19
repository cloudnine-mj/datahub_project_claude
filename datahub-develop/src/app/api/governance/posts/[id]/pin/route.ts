/**
 * PATCH /api/governance/posts/[id]/pin — 상단 고정 토글 (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_post_pin_toggle", "governance_post");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");
  if (!auth.isAdmin) return audit.fail(403, "관리자만 상단 고정을 변경할 수 있습니다.");

  const post = await prisma.governancePost.findUnique({ where: { id: params.id } });
  if (!post) return audit.fail(404, "post not found", { resourceId: params.id });

  const updated = await prisma.governancePost.update({
    where: { id: post.id },
    data: { pinned: !post.pinned },
  });
  return audit.ok(200, NextResponse.json(updated), { resourceId: updated.id });
}
