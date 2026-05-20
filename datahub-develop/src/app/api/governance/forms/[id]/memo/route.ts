/**
 * GET /api/governance/forms/[id]/memo — 관리자 전용 메모 엔트리 목록 (날짜순)
 *
 * 관리자만 호출 가능. 비관리자는 403. 응답은 신청자에게 노출되지 않는다.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_admin_memo_list", "governance_admin_memo");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");
  if (!auth.isAdmin) return audit.fail(403, "관리자 전용 메모입니다.");

  const form = await prisma.governanceForm.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  const entries = await prisma.governanceAdminMemo.findMany({
    where: { formId: form.id },
    orderBy: { date: "asc" },
  });
  return audit.ok(200, NextResponse.json({ entries }));
}
