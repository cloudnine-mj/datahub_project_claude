/**
 * PUT    /api/governance/forms/[id]/memo/[date] — 해당 날짜의 메모 upsert
 * DELETE /api/governance/forms/[id]/memo/[date] — 해당 날짜의 메모 삭제
 *
 * 관리자 전용. 변경 시 GovernanceAdminMemoAudit 에 자동 감사 기록.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string; date: string };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_admin_memo_upsert", "governance_admin_memo");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");
  if (!auth.isAdmin) return audit.fail(403, "관리자 전용 메모입니다.");

  if (!DATE_RE.test(params.date)) {
    return audit.fail(400, "date 는 YYYY-MM-DD 형식이어야 합니다.");
  }

  let body: { content?: string };
  try {
    body = (await request.json()) as { content?: string };
  } catch {
    return audit.fail(400, "invalid JSON body");
  }
  const content = (body.content ?? "").toString();

  const form = await prisma.governanceForm.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  const existing = await prisma.governanceAdminMemo.findUnique({
    where: { formId_date: { formId: form.id, date: params.date } },
  });

  const actorId = auth.dbUser.id;
  const actorName = auth.dbUser.name ?? auth.session.user.email;

  const entry = existing
    ? await prisma.governanceAdminMemo.update({
        where: { id: existing.id },
        data: {
          content,
          lastUpdatedById: actorId,
          lastUpdatedByName: actorName,
          revisionCount: { increment: 1 },
        },
      })
    : await prisma.governanceAdminMemo.create({
        data: {
          formId: form.id,
          date: params.date,
          content,
          createdById: actorId,
          createdByName: actorName,
          lastUpdatedById: actorId,
          lastUpdatedByName: actorName,
        },
      });

  await prisma.governanceAdminMemoAudit.create({
    data: {
      formId: form.id,
      date: params.date,
      action: existing ? "update" : "create",
      actorId,
      actorName,
      contentBefore: existing?.content ?? null,
      contentAfter: content,
    },
  });

  return audit.ok(200, NextResponse.json(entry), { resourceId: entry.id });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_admin_memo_delete", "governance_admin_memo");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");
  if (!auth.isAdmin) return audit.fail(403, "관리자 전용 메모입니다.");

  if (!DATE_RE.test(params.date)) {
    return audit.fail(400, "date 는 YYYY-MM-DD 형식이어야 합니다.");
  }

  const existing = await prisma.governanceAdminMemo.findUnique({
    where: { formId_date: { formId: params.id, date: params.date } },
  });
  if (!existing) {
    // 멱등성 — 없으면 그대로 204
    return audit.ok(204, new NextResponse(null, { status: 204 }));
  }

  await prisma.governanceAdminMemo.delete({ where: { id: existing.id } });
  await prisma.governanceAdminMemoAudit.create({
    data: {
      formId: params.id,
      date: params.date,
      action: "delete",
      actorId: auth.dbUser.id,
      actorName: auth.dbUser.name ?? auth.session.user.email,
      contentBefore: existing.content,
      contentAfter: null,
    },
  });

  return audit.ok(204, new NextResponse(null, { status: 204 }));
}
