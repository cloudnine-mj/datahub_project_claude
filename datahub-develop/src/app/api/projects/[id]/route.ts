import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function adminGuard(session: any) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        pmLeader: { select: { id: true, name: true, email: true } },
        tmLeader: { select: { id: true, name: true, email: true } },
        lab: { select: { id: true, name: true } },
        _count: { select: { plans: true, reports: true } },
      },
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const err = adminGuard(session);
    if (err) return err;

    const body = await request.json();
    const project = await prisma.project.update({
      where: { id: params.id },
      data: {
        name: body.name,
        pmsCode: body.pmsCode || null,
        pmLeaderId: body.pmLeaderId || null,
        tmLeaderId: body.tmLeaderId || null,
        labId: body.labId || null,
        budget: Number(body.budget) || 0,
        quarter: body.quarter || null,
        year: body.year ?? null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        status: body.status,
      },
      include: {
        pmLeader: { select: { id: true, name: true, email: true } },
        tmLeader: { select: { id: true, name: true, email: true } },
        lab: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const err = adminGuard(session);
    if (err) return err;

    await prisma.project.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
