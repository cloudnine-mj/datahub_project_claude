/**
 * POST /api/governance/forms/[id]/events — 진행 이력(approvalHistory)에 이벤트 1건 추가.
 *
 * 상태 전이를 동반하지 않는 협업 단계 이벤트(담당자 지정 / 검토중 / 승인 / 보완 요청)를
 * 진행 이력 타임라인에 남기기 위한 경량 엔드포인트. form.status 는 바꾸지 않고
 * approvalHistory 에만 append 한다. (admin 전용 status 전이는 /status route 가 담당.)
 *
 * Phase 1: 용역 제작 협업 흐름은 별도 권한 가드가 없으므로 로그인된 거버넌스 사용자면 기록 가능.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

const EVENT_ACTIONS = new Set([
  "assigned",
  "edited",
  "review_started",
  "info_requested",
  "approved",
]);

interface RouteContext {
  params: { id: string };
}

interface HistoryEntry {
  status: string;
  changedBy: string;
  changedAt: string;
  comment?: string | null;
  action?: string;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_event_append", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  let body: { action?: string; comment?: string };
  try {
    body = (await request.json()) as { action?: string; comment?: string };
  } catch {
    return audit.fail(400, "invalid JSON body");
  }
  if (!body.action || !EVENT_ACTIONS.has(body.action)) {
    return audit.fail(400, `unknown event action: ${body.action}`);
  }

  const form = await prisma.governanceForm.findUnique({ where: { id: params.id } });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  const history: HistoryEntry[] = Array.isArray(form.approvalHistory)
    ? (form.approvalHistory as unknown as HistoryEntry[])
    : [];
  const commentText = (body.comment ?? "").trim();

  // 멱등성 — 직전 entry 와 action·comment 가 동일하면 중복 기록하지 않음
  // (자유로운 단계 이동/버튼 재클릭으로 인한 이벤트 폭주 방지).
  const last = history[history.length - 1];
  if (last && last.action === body.action && (last.comment ?? "") === commentText) {
    return audit.ok(200, NextResponse.json(form), { resourceId: form.id });
  }

  history.push({
    status: form.status,
    changedBy: auth.dbUser.name ?? auth.session.user.email,
    changedAt: new Date().toISOString(),
    comment: commentText || null,
    action: body.action,
  });

  const updated = await prisma.governanceForm.update({
    where: { id: form.id },
    data: { approvalHistory: history as unknown as object },
    include: {
      attachments: { select: { id: true, filename: true, sizeBytes: true } },
    },
  });

  return audit.ok(200, NextResponse.json(updated), { resourceId: updated.id });
}
