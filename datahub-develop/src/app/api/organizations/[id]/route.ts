import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

function adminGuard(session: any) {
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return null;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const err = adminGuard(session);
    if (err) return err;

    const body = await request.json();
    const { type, name, leaderId } = body;

    if (type === "techCell") {
      const tc = await prisma.techCell.update({
        where: { id: params.id },
        data: { name, leaderId: leaderId || null },
        include: { leader: { select: { id: true, name: true, email: true } } },
      });
      return NextResponse.json(tc);
    }

    const lab = await prisma.lab.update({
      where: { id: params.id },
      data: { name, leaderId: leaderId || null },
      include: {
        leader: { select: { id: true, name: true, email: true } },
        techCells: true,
      },
    });
    return NextResponse.json(lab);
  } catch (error) {
    console.error("Failed to update organization:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const err = adminGuard(session);
    if (err) return err;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "techCell") {
      await prisma.techCell.delete({ where: { id: params.id } });
    } else {
      await prisma.lab.delete({ where: { id: params.id } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete organization:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
