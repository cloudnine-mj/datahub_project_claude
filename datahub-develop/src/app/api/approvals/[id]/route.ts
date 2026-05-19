import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDbUser } from "@/lib/db-user";
import { prisma } from "@/lib/prisma";
import { processApprovalStep } from "@/lib/approval-engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const approvalRequest = await prisma.approvalRequest.findUnique({
      where: { id },
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
    });

    if (!approvalRequest) {
      return NextResponse.json(
        { error: "Approval request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(approvalRequest);
  } catch (error) {
    console.error("Failed to fetch approval request:", error);
    return NextResponse.json(
      { error: "Failed to fetch approval request" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const dbUser = await getDbUser(session);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userId = dbUser.id;
    const body = await request.json();
    const { action, comment } = body;

    if (!action || !["APPROVED", "REJECTED"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be APPROVED or REJECTED" },
        { status: 400 }
      );
    }

    const result = await processApprovalStep(id, userId, action, comment);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to process approval step:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process approval step";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
