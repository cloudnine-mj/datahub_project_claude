/**
 * PATCH  /api/governance/forms/[id]/messages/[messageId] — 코멘트 본문 수정 (작성자 본인만)
 * DELETE /api/governance/forms/[id]/messages/[messageId] — 코멘트 삭제 (작성자 본인만)
 *
 * 권한: 발신자 본인만 수정 / 삭제 가능. admin 이라도 타인 메시지 직접 편집은 차단.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string; messageId: string };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_message_update", "governance_form_message");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  let body: { body?: string };
  try {
    body = (await request.json()) as { body?: string };
  } catch {
    return audit.fail(400, "invalid JSON body");
  }
  const text = (body.body ?? "").trim();
  if (text.length === 0) {
    return audit.fail(400, "본문이 비어 있습니다.");
  }

  const msg = await prisma.governanceFormMessage.findUnique({
    where: { id: params.messageId },
    select: { id: true, formId: true, senderId: true },
  });
  if (!msg || msg.formId !== params.id) {
    return audit.fail(404, "message not found", { resourceId: params.messageId });
  }
  if (msg.senderId !== auth.dbUser.id) {
    return audit.fail(403, "본인이 작성한 코멘트만 수정할 수 있습니다.");
  }

  const updated = await prisma.governanceFormMessage.update({
    where: { id: msg.id },
    data: { body: text },
    include: {
      attachments: { select: { id: true, filename: true, sizeBytes: true } },
    },
  });

  return audit.ok(200, NextResponse.json(updated), { resourceId: updated.id });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_message_delete", "governance_form_message");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const msg = await prisma.governanceFormMessage.findUnique({
    where: { id: params.messageId },
    select: { id: true, formId: true, senderId: true },
  });
  if (!msg || msg.formId !== params.id) {
    return audit.fail(404, "message not found", { resourceId: params.messageId });
  }
  if (msg.senderId !== auth.dbUser.id) {
    return audit.fail(403, "본인이 작성한 코멘트만 삭제할 수 있습니다.");
  }

  await prisma.governanceFormMessage.delete({ where: { id: msg.id } });
  return audit.ok(204, new NextResponse(null, { status: 204 }), {
    resourceId: msg.id,
  });
}
