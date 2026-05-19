/**
 * PATCH /api/governance/forms/[id]/status — admin 의 신청 상태 변경.
 * datahub-web `forms.py::change_form_status` 포팅.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

const STATUS_VALUES = new Set(["draft", "submitted", "reviewing", "approved", "rejected"]);

interface RouteContext {
  params: { id: string };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_status_change", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");
  if (!auth.isAdmin) return audit.fail(403, "관리자만 상태를 변경할 수 있습니다.");

  let body: { status?: string; comment?: string };
  try {
    body = (await request.json()) as { status?: string; comment?: string };
  } catch {
    return audit.fail(400, "invalid JSON body");
  }
  if (!body.status || !STATUS_VALUES.has(body.status)) {
    return audit.fail(400, `unknown status: ${body.status}`);
  }

  const form = await prisma.governanceForm.findUnique({ where: { id: params.id } });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  // 자기 결재 방지 — admin 이라도 본인 신청은 본인이 처리 X
  if (form.submitterId === auth.dbUser.id) {
    return audit.fail(403, "본인이 제출한 신청의 상태는 변경할 수 없습니다.");
  }

  const history = Array.isArray(form.approvalHistory)
    ? (form.approvalHistory as unknown as { status: string; changedBy: string; changedAt: string; comment?: string | null }[])
    : [];
  history.push({
    status: body.status,
    changedBy: auth.dbUser.name ?? auth.session.user.email,
    changedAt: new Date().toISOString(),
    comment: body.comment ?? null,
  });

  const updated = await prisma.governanceForm.update({
    where: { id: form.id },
    data: { status: body.status, approvalHistory: history as unknown as object },
  });
  return audit.ok(200, NextResponse.json(updated), { resourceId: updated.id });
}
