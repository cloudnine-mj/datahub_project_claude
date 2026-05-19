import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getPlatformToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const plan = await prisma.plan.findUnique({
      where: { id },
      include: {
        project: true,
        author: { select: { id: true, name: true, email: true, image: true } },
        dataManager: { select: { id: true, name: true, email: true, image: true } },
        qualityManager: { select: { id: true, name: true, email: true, image: true } },
        techCell: true,
        lab: true,
        approvalRequests: {
          include: {
            steps: {
              include: {
                approver: { select: { id: true, name: true, email: true, image: true } },
              },
              orderBy: { stepOrder: "asc" },
            },
            config: true,
          },
          orderBy: { createdAt: "desc" },
        },
        reports: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to fetch plan:", error);
    return NextResponse.json(
      { error: "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getPlatformToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    // Remove fields that don't exist in the Plan model
    const { year, ...rest } = body;
    const data: any = { ...rest };
    for (const key of ["dataManagerId", "qualityManagerId", "techCellId", "labId"]) {
      if (data[key] === "" || data[key] === undefined) data[key] = null;
    }

    const plan = await prisma.plan.update({
      where: { id },
      data,
      include: {
        project: true,
        author: { select: { id: true, name: true, email: true, image: true } },
        dataManager: { select: { id: true, name: true, email: true, image: true } },
        qualityManager: { select: { id: true, name: true, email: true, image: true } },
        techCell: true,
        lab: true,
      },
    });

    return NextResponse.json(plan);
  } catch (error) {
    console.error("Failed to update plan:", error);
    return NextResponse.json(
      { error: "Failed to update plan" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getPlatformToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT plans can be deleted" },
        { status: 400 }
      );
    }

    await prisma.plan.delete({ where: { id } });

    return NextResponse.json({ message: "Plan deleted successfully" });
  } catch (error) {
    console.error("Failed to delete plan:", error);
    return NextResponse.json(
      { error: "Failed to delete plan" },
      { status: 500 }
    );
  }
}
