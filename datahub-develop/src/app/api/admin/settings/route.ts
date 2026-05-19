import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = await prisma.approvalConfig.findMany({
      include: {
        _count: { select: { requests: true } },
      },
      orderBy: { type: "asc" },
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("Failed to fetch approval configs:", error);
    return NextResponse.json({ error: "Failed to fetch approval configs" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, steps, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Config id is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (steps !== undefined) updateData.steps = steps;
    if (isActive !== undefined) updateData.isActive = isActive;

    const config = await prisma.approvalConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("Failed to update approval config:", error);
    return NextResponse.json({ error: "Failed to update approval config" }, { status: 500 });
  }
}
