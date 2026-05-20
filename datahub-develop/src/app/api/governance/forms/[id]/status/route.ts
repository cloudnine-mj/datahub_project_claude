/**
 * PATCH /api/governance/forms/[id]/status — admin 의 신청 상태 변경.
 *
 * datahub-web `forms.py::change_form_status` 포팅.
 *
 * 진행 이력 기록 정합성:
 *   - 명시적 action 필드를 entry 에 저장하여 프론트가 정확한 라벨/아이콘으로 렌더.
 *   - 같은 status 로의 전이 + 같은 action + comment 없음 → no-op (멱등성).
 *   - 보완 요청 코멘트 prefix '[보완 요청]' 또는 body.action='info_requested'
 *     → action=info_requested. 이전에 info_requested 가 있었던 검토 시작은
 *     review_resumed 로 자동 분기.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import {
  requireGovernanceAuth,
  resolveChatRole,
  resolveRecipient,
} from "@/lib/governance/auth";

const STATUS_VALUES = new Set(["draft", "submitted", "reviewing", "approved", "rejected"]);
const ACTION_VALUES = new Set([
  "submitted",
  "review_started",
  "info_requested",
  "info_resubmitted",
  "review_resumed",
  "approved",
  "draft",
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

function infoRequestCommentPrefix(comment: string | null | undefined): boolean {
  if (!comment) return false;
  return /^\s*\[보완\s*요청\]/.test(comment);
}

/** 현재 status + 새 status + 코멘트 + 이전 이력으로부터 action 코드 결정. */
function determineAction(
  prevStatus: string,
  nextStatus: string,
  comment: string,
  history: HistoryEntry[],
  explicitAction?: string,
): string | null {
  if (explicitAction && ACTION_VALUES.has(explicitAction)) return explicitAction;
  const hadPriorInfoRequest = history.some((h) => h.action === "info_requested");
  if (infoRequestCommentPrefix(comment)) return "info_requested";
  if (nextStatus === "approved") return "approved";
  if (nextStatus === "draft") return "draft";
  if (nextStatus === "submitted") {
    return hadPriorInfoRequest ? "info_resubmitted" : "submitted";
  }
  if (nextStatus === "reviewing") {
    return hadPriorInfoRequest ? "review_resumed" : "review_started";
  }
  return null;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_status_change", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");
  if (!auth.isAdmin) return audit.fail(403, "관리자만 상태를 변경할 수 있습니다.");

  let body: { status?: string; comment?: string; action?: string };
  try {
    body = (await request.json()) as { status?: string; comment?: string; action?: string };
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

  const history: HistoryEntry[] = Array.isArray(form.approvalHistory)
    ? (form.approvalHistory as unknown as HistoryEntry[])
    : [];
  const commentText = (body.comment ?? "").trim();
  const newAction = determineAction(form.status, body.status, commentText, history, body.action);

  // 멱등성: 동일 status 로의 전이 + 코멘트 없음 + 직전 entry 와 같은 action 이면 no-op.
  const lastEntry = history[history.length - 1];
  const isNoop =
    form.status === body.status &&
    commentText.length === 0 &&
    !!lastEntry &&
    !!newAction &&
    lastEntry.action === newAction;
  if (isNoop) {
    return audit.ok(200, NextResponse.json(form), { resourceId: form.id });
  }

  history.push({
    status: body.status,
    changedBy: auth.dbUser.name ?? auth.session.user.email,
    changedAt: new Date().toISOString(),
    comment: body.comment ?? null,
    action: newAction ?? undefined,
  });

  // 상태 변경 + (코멘트가 있으면) 메시지 생성을 transaction 으로 atomic 하게 처리.
  const senderRole = resolveChatRole(form, auth);
  const recipient = resolveRecipient(form, senderRole);

  const [updated] = await prisma.$transaction([
    prisma.governanceForm.update({
      where: { id: form.id },
      data: { status: body.status, approvalHistory: history as unknown as object },
    }),
    ...(commentText.length > 0
      ? [
          prisma.governanceFormMessage.create({
            data: {
              formId: form.id,
              senderId: auth.dbUser.id,
              senderName: auth.dbUser.name ?? auth.session.user.email,
              senderEmail: auth.session.user.email,
              senderRole,
              recipientName: recipient.name,
              recipientRole: recipient.role,
              body: commentText,
            },
          }),
        ]
      : []),
  ]);

  return audit.ok(200, NextResponse.json(updated), { resourceId: updated.id });
}
