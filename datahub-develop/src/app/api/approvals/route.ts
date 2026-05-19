import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDbUser } from "@/lib/db-user";
import { prisma } from "@/lib/prisma";
import {
  createApprovalRequest,
  createReportApprovalRequest,
} from "@/lib/approval-engine";

export async function GET(_request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await getDbUser(session);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userId = dbUser.id;

    const pendingSteps = await prisma.approvalStep.findMany({
      where: {
        approverId: userId,
        status: "PENDING",
      },
      include: {
        request: {
          include: {
            plan: {
              include: {
                project: true,
                author: { select: { id: true, name: true, email: true, image: true } },
              },
            },
            report: {
              include: {
                plan: true,
                project: true,
                author: { select: { id: true, name: true, email: true, image: true } },
              },
            },
            config: true,
            steps: {
              include: {
                approver: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { stepOrder: "asc" },
            },
          },
        },
      },
      orderBy: { request: { createdAt: "desc" } },
    });

    return NextResponse.json(pendingSteps);
  } catch (error) {
    console.error("Failed to fetch approvals:", error);
    return NextResponse.json(
      { error: "Failed to fetch approvals" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planId, reportId, configType } = body;

    if (!planId && !reportId) {
      return NextResponse.json(
        { error: "Either planId or reportId is required" },
        { status: 400 }
      );
    }

    let result;
    if (planId) {
      result = await createApprovalRequest(planId, configType);
    } else {
      result = await createReportApprovalRequest(reportId, configType);
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Failed to create approval request:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create approval request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
