/**
 * GET  /api/governance/forms  — 목록 (mine 필터, form_type 필터)
 * POST /api/governance/forms  — 신청 제출 (또는 draft)
 *
 * datahub-web `app/api/routes/forms.py` 의 list_forms / submit_form 포팅.
 */

import { NextRequest, NextResponse } from "next/server";
import { startAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireGovernanceAuth } from "@/lib/governance/auth";
import { nextRequestNo } from "@/lib/governance/request-no";

const FORM_TYPES = new Set([
  "data_production",
  "data_purchase",
  "data_subscription",
  "product_log_usage",
  "data_production_plan",
  "api_usage_plan",
  "productivity_tool",
]);

export async function GET(request: NextRequest) {
  const audit = startAudit(request, "governance_form_list", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  const { searchParams } = request.nextUrl;
  const mine = searchParams.get("mine") !== "false";
  const formType = searchParams.get("form_type");

  if (formType && !FORM_TYPES.has(formType)) {
    return audit.fail(400, `unknown form_type: ${formType}`);
  }

  const where: { submitterId?: string; formType?: string } = {};
  if (mine) where.submitterId = auth.dbUser.id;
  if (formType) where.formType = formType;

  const forms = await prisma.governanceForm.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      requestNo: true,
      formType: true,
      projectName: true,
      submitterName: true,
      submittedAt: true,
      status: true,
      version: true,
      parentFormId: true,
      payload: true,
      approvalHistory: true,
    },
  });

  // payload['참조자'] → participants, approvalHistory 의 마지막 approved 이벤트 → approvedAt
  const items = forms.map((f) => {
    const raw = (f.payload as Record<string, unknown> | null)?.["참조자"];
    const participants = Array.isArray(raw)
      ? raw.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];

    let approvedAt: string | null = null;
    if (f.status === "approved" && Array.isArray(f.approvalHistory)) {
      const history = f.approvalHistory as { status?: string; changedAt?: string }[];
      for (let i = history.length - 1; i >= 0; i--) {
        const entry = history[i];
        if (entry?.status === "approved" && entry.changedAt) {
          approvedAt = entry.changedAt;
          break;
        }
      }
    }

    const { payload, approvalHistory, ...rest } = f;
    void payload;
    void approvalHistory;
    return { ...rest, participants, approvedAt };
  });

  return audit.ok(200, NextResponse.json(items));
}

interface FormCreateBody {
  form_type?: string;
  project_name?: string;
  payload?: Record<string, unknown>;
  status?: string;
  submitter_name?: string;
  submitter_email?: string;
  submitter_department?: string;
}

export async function POST(request: NextRequest) {
  const audit = startAudit(request, "governance_form_create", "governance_form");
  const auth = await requireGovernanceAuth();
  if (!auth) return audit.fail(401, "Unauthorized");

  let body: FormCreateBody;
  try {
    body = (await request.json()) as FormCreateBody;
  } catch {
    return audit.fail(400, "invalid JSON body");
  }

  const formType = body.form_type ?? "";
  if (!FORM_TYPES.has(formType)) {
    return audit.fail(400, `unknown form_type: ${formType}`);
  }

  const projectName = (body.project_name ?? "").trim();
  if (!projectName) return audit.fail(400, "project_name is required");

  const status = body.status ?? "submitted";
  const requestNo = await nextRequestNo();
  const now = new Date();

  const initialHistory =
    status === "submitted"
      ? [
          {
            status: "submitted",
            changedBy: auth.dbUser.name ?? auth.session.user.email,
            changedAt: now.toISOString(),
            comment: "최초 제출",
          },
        ]
      : status === "draft"
        ? [
            {
              status: "draft",
              changedBy: auth.dbUser.name ?? auth.session.user.email,
              changedAt: now.toISOString(),
              comment: "임시 저장",
            },
          ]
        : [];

  const created = await prisma.governanceForm.create({
    data: {
      requestNo,
      formType,
      projectName,
      submitterId: auth.dbUser.id,
      submitterName: body.submitter_name ?? auth.dbUser.name ?? auth.session.user.email,
      submitterEmail: body.submitter_email ?? auth.session.user.email,
      submitterDepartment: body.submitter_department ?? null,
      status,
      payload: (body.payload ?? {}) as object,
      approvalHistory: initialHistory.length > 0 ? initialHistory : undefined,
    },
  });

  return audit.ok(201, NextResponse.json(created), { resourceId: created.id });
}
