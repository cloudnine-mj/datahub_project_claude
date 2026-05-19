import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const token = await getPlatformToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get("targetType");
    const year = searchParams.get("year");
    const quarter = searchParams.get("quarter");

    const where: any = {};
    if (targetType) { where.targetType = targetType; }
    if (year) { where.year = parseInt(year); }
    if (quarter) { where.quarter = quarter; }

    const budgets = await prisma.budget.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, pmsCode: true } },
        lab: { select: { id: true, name: true } },
        techCell: { select: { id: true, name: true } },
        costRecords: {
          include: { plan: { select: { id: true, dataName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(budgets);
  } catch (error) {
    console.error("Failed to fetch budgets:", error);
    return NextResponse.json({ error: "Failed to fetch budgets" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getPlatformToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { targetType, targetId, quarter, year, totalAmount } = body;

    const budget = await prisma.budget.upsert({
      where: {
        targetType_targetId_quarter_year: { targetType, targetId, quarter, year },
      },
      update: { totalAmount },
      create: {
        targetType,
        targetId,
        quarter,
        year,
        totalAmount: totalAmount || 0,
      },
      include: {
        project: { select: { id: true, name: true, pmsCode: true } },
        lab: { select: { id: true, name: true } },
        techCell: { select: { id: true, name: true } },
        costRecords: true,
      },
    });

    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error("Failed to create/update budget:", error);
    return NextResponse.json({ error: "Failed to create/update budget" }, { status: 500 });
  }
}
