/**
 * GET  /api/governance/forms/[id]/messages — 진행 이력 채팅 메시지 목록
 * POST /api/governance/forms/[id]/messages — 메시지 작성 (신청자/담당자/admin)
 *
 * 회신 대상(recipient) 은 발신 시점에 자동 결정되어 스냅샷 저장.
 * datahub-web `forms.py` 의 list_form_messages / create_form_message 포팅.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  requireGovernanceAuth,
  resolveChatRole,
  resolveRecipient,
} from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_message_list", "governance_form_message");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const form = await prisma.governanceForm.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  const messages = await prisma.governanceFormMessage.findMany({
    where: { formId: form.id },
    orderBy: { createdAt: "asc" },
    include: {
      attachments: { select: { id: true, filename: true, sizeBytes: true } },
    },
  });
  return audit.ok(200, NextResponse.json(messages));
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_message_create", "governance_form_message");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  let body: { body?: string };
  try {
    body = (await request.json()) as { body?: string };
  } catch {
    return audit.fail(400, "invalid JSON body");
  }
  const text = (body.body ?? "").trim();
  if (!text) return audit.fail(400, "메시지 본문을 입력하세요.");

  const form = await prisma.governanceForm.findUnique({
    where: { id: params.id },
    select: { id: true, submitterEmail: true, submitterName: true },
  });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  const senderRole = resolveChatRole(form, auth);
  if (senderRole === "observer") {
    return audit.fail(403, "이 신청서에 메시지를 작성할 권한이 없습니다.");
  }

  const recipient = resolveRecipient(form, senderRole);

  const created = await prisma.governanceFormMessage.create({
    data: {
      formId: form.id,
      senderId: auth.dbUser.id,
      senderName: auth.dbUser.name ?? auth.session.user.email,
      senderEmail: auth.session.user.email,
      senderRole,
      recipientName: recipient.name,
      recipientRole: recipient.role,
      body: text,
    },
    include: {
      attachments: { select: { id: true, filename: true, sizeBytes: true } },
    },
  });

  return audit.ok(201, NextResponse.json(created), { resourceId: created.id });
}
