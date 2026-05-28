/**
 * GET    /api/governance/forms/[id]  — 상세 (로그인된 사용자 누구나 read-only)
 * PATCH  /api/governance/forms/[id]  — 수정 (제출자 본인 or admin)
 * DELETE /api/governance/forms/[id]  — 삭제 (제출자 본인 or admin)
 *
 * datahub-web `forms.py` 의 get_form / update_form / delete_form 포팅.
 * 진행 이력 누적 로직 (재제출 / 내용 수정 / 임시 저장 갱신) 그대로 유지.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";

const FORM_TYPES = new Set([
  "data_production",
  "data_purchase",
  "data_subscription",
  "product_log_usage",
  "data_production_plan",
  "api_usage_plan",
  "productivity_tool",
]);

interface RouteContext {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_get", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const form = await prisma.governanceForm.findUnique({
    where: { id: params.id },
    include: {
      attachments: { select: { id: true, filename: true, sizeBytes: true } },
    },
  });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  return audit.ok(200, NextResponse.json(form), { resourceId: form.id });
}

interface FormUpdateBody {
  form_type?: string;
  project_name?: string;
  payload?: Record<string, unknown>;
  status?: string;
  submitter_name?: string | null;
  submitter_email?: string | null;
  submitter_department?: string | null;
}

interface ApprovalEntry {
  status: string;
  changedBy: string;
  changedAt: string;
  comment?: string | null;
  action?: string;
}

interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

function computeDiff(
  before: { projectName: string; submitterName: string; submitterEmail: string; submitterDepartment: string | null; payload: Record<string, unknown> },
  after: FormUpdateBody,
): FieldChange[] {
  const out: FieldChange[] = [];
  if (after.project_name !== undefined && before.projectName !== after.project_name) {
    out.push({ field: "프로젝트명", before: before.projectName, after: after.project_name });
  }
  const fields: [string, unknown, unknown][] = [
    ["신청자 이름", before.submitterName, after.submitter_name],
    ["이메일", before.submitterEmail, after.submitter_email],
    ["소속", before.submitterDepartment, after.submitter_department],
  ];
  for (const [label, b, a] of fields) {
    if (a !== undefined && a !== null && b !== a) {
      out.push({ field: label, before: b, after: a });
    }
  }
  const beforePayload = before.payload ?? {};
  const afterPayload = (after.payload ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(beforePayload), ...Object.keys(afterPayload)]);
  keys.forEach((k) => {
    if (JSON.stringify(beforePayload[k]) !== JSON.stringify(afterPayload[k])) {
      out.push({ field: k, before: beforePayload[k], after: afterPayload[k] });
    }
  });
  return out;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_update", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  let body: FormUpdateBody;
  try {
    body = (await request.json()) as FormUpdateBody;
  } catch {
    return audit.fail(400, "invalid JSON body");
  }

  const form = await prisma.governanceForm.findUnique({ where: { id: params.id } });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  // 수정 권한 — 작성자 본인 또는 admin.
  // admin 은 검토 중 데이터 보정 등을 위해 타인 신청도 수정 가능.
  if (form.submitterId !== auth.dbUser.id && !auth.isAdmin) {
    return audit.fail(403, "수정 권한이 없습니다.");
  }

  if (body.form_type && !FORM_TYPES.has(body.form_type)) {
    return audit.fail(400, `unknown form_type: ${body.form_type}`);
  }

  const prevStatus = form.status;
  // 보완 요청됨 상태에서 신청자가 재제출하면 자동으로 검토 중으로 복귀.
  // 신청자가 명시적으로 status='submitted' 를 보내더라도 reviewing 으로 override.
  let nextStatus = body.status ?? form.status;
  if (prevStatus === "info_requested" && nextStatus === "submitted") {
    nextStatus = "reviewing";
  }
  const changes = computeDiff(
    {
      projectName: form.projectName,
      submitterName: form.submitterName,
      submitterEmail: form.submitterEmail,
      submitterDepartment: form.submitterDepartment,
      payload: (form.payload as Record<string, unknown> | null) ?? {},
    },
    body,
  );

  const history: ApprovalEntry[] = Array.isArray(form.approvalHistory)
    ? (form.approvalHistory as unknown as ApprovalEntry[])
    : [];
  const append = (status: string, comment: string, action: string) => {
    history.push({
      status,
      changedBy: auth.dbUser.name ?? auth.session.user.email,
      changedAt: new Date().toISOString(),
      comment,
      action,
    });
  };
  const hadPriorInfoRequest = history.some((h) => h.action === "info_requested");
  // 이 신청서가 한 번이라도 제출된 적이 있는지 — 순수 draft 작성 중의 내용 변경은
  // '수정' 이벤트로 남기지 않기 위함.
  const wasEverSubmitted =
    prevStatus !== "draft" ||
    history.some(
      (h) =>
        h.status === "submitted" ||
        h.action === "submitted" ||
        h.action === "info_resubmitted",
    );
  let loggedTransition = false;

  if (prevStatus !== nextStatus) {
    if (nextStatus === "submitted") {
      // 재제출 — 이전에 보완 요청이 있었다면 info_resubmitted, 아니면 첫 제출(submitted).
      if (hadPriorInfoRequest) {
        append("submitted", "보완 자료 재제출", "info_resubmitted");
      } else {
        append("submitted", "최초 제출", "submitted");
      }
      loggedTransition = true;
    } else if (nextStatus === "reviewing" && prevStatus === "info_requested") {
      // 보완 요청됨 → reviewing 자동 전이 (신청자 재제출). info_resubmitted 로 기록.
      append("reviewing", "보완 자료 재제출", "info_resubmitted");
      loggedTransition = true;
    } else if (nextStatus === "draft") {
      append("draft", "임시 저장", "draft");
      loggedTransition = true;
    }
  } else if (changes.length > 0 && nextStatus === "draft") {
    append("draft", "임시 저장 갱신", "draft");
    loggedTransition = true;
  }

  // 제출된 신청서의 내용 수정 → 진행 이력에 '신청서 수정'(edited) 이벤트로 기록.
  // 상태 전이가 이미 기록됐거나(중복 방지) 아직 제출 전 draft 작성 중이면 제외.
  if (!loggedTransition && changes.length > 0 && wasEverSubmitted && nextStatus !== "draft") {
    append(nextStatus, "신청서 수정", "edited");
  }

  const editHistory: { editedBy: string; editedAt: string; changes: FieldChange[] }[] = Array.isArray(form.editHistory)
    ? (form.editHistory as unknown as { editedBy: string; editedAt: string; changes: FieldChange[] }[])
    : [];
  if (changes.length > 0) {
    editHistory.push({
      editedBy: auth.dbUser.name ?? auth.session.user.email,
      editedAt: new Date().toISOString(),
      changes,
    });
  }

  const updated = await prisma.governanceForm.update({
    where: { id: form.id },
    data: {
      projectName: body.project_name ?? form.projectName,
      payload: (body.payload ?? form.payload) as object,
      status: nextStatus,
      submitterName: body.submitter_name ?? form.submitterName,
      submitterEmail: body.submitter_email ?? form.submitterEmail,
      submitterDepartment: body.submitter_department ?? form.submitterDepartment,
      approvalHistory: history as unknown as object,
      editHistory: editHistory.length > 0 ? (editHistory as unknown as object) : form.editHistory ?? undefined,
    },
    include: {
      attachments: { select: { id: true, filename: true, sizeBytes: true } },
    },
  });

  return audit.ok(200, NextResponse.json(updated), { resourceId: updated.id });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const audit = startAudit(request, "governance_form_delete", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const form = await prisma.governanceForm.findUnique({ where: { id: params.id } });
  if (!form) return audit.fail(404, "form not found", { resourceId: params.id });

  if (form.submitterId !== auth.dbUser.id && !auth.isAdmin) {
    return audit.fail(403, "삭제 권한이 없습니다.");
  }

  await prisma.governanceForm.delete({ where: { id: form.id } });
  return audit.ok(204, new NextResponse(null, { status: 204 }), {
    resourceId: form.id,
  });
}
