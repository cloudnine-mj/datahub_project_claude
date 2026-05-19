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

    const report = await prisma.constructionReport.findUnique({
      where: { id },
      include: {
        plan: { include: { project: true } },
        project: true,
        author: { select: { id: true, name: true, email: true, image: true } },
        dataManager: { select: { id: true, name: true, email: true, image: true } },
        qualityManager: { select: { id: true, name: true, email: true, image: true } },
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
        dataCards: true,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to fetch report:", error);
    return NextResponse.json({ error: "Failed to fetch report" }, { status: 500 });
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

    const existing = await prisma.constructionReport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const report = await prisma.constructionReport.update({
      where: { id },
      data: body,
      include: {
        plan: true,
        project: true,
        author: { select: { id: true, name: true, email: true, image: true } },
        dataManager: { select: { id: true, name: true, email: true, image: true } },
        qualityManager: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error("Failed to update report:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
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

    const existing = await prisma.constructionReport.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only DRAFT reports can be deleted" },
        { status: 400 }
      );
    }

    await prisma.constructionReport.delete({ where: { id } });

    return NextResponse.json({ message: "Report deleted successfully" });
  } catch (error) {
    console.error("Failed to delete report:", error);
    return NextResponse.json({ error: "Failed to delete report" }, { status: 500 });
  }
}
