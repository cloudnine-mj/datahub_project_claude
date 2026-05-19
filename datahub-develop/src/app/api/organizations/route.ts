import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const labs = await prisma.lab.findMany({
      include: {
        leader: { select: { id: true, name: true, email: true } },
        techCells: {
          include: {
            leader: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true } },
          },
          orderBy: { name: "asc" },
        },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(labs);
  } catch (error) {
    console.error("Failed to fetch organizations:", error);
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { type, name, labId, leaderId } = body;

    if (type === "techCell") {
      if (!labId) return NextResponse.json({ error: "labId is required" }, { status: 400 });
      const tc = await prisma.techCell.create({
        data: { name, labId, leaderId: leaderId || null },
        include: { leader: { select: { id: true, name: true, email: true } } },
      });
      return NextResponse.json(tc, { status: 201 });
    }

    // Default: create lab
    const lab = await prisma.lab.create({
      data: { name, leaderId: leaderId || null },
      include: {
        leader: { select: { id: true, name: true, email: true } },
        techCells: true,
      },
    });
    return NextResponse.json(lab, { status: 201 });
  } catch (error) {
    console.error("Failed to create organization:", error);
    return NextResponse.json({ error: "Failed to create organization" }, { status: 500 });
  }
}
