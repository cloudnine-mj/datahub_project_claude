import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getDbUser } from "@/lib/db-user";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  // Web 전용 Prisma user.id 를 함께 노출 — 클라이언트가 "내가 작성한 레코드"를
  // 필터할 때 authorId 와 비교하는 용도. Prisma 장애 시엔 email 을 id 로 사용.
  let dbUser = null;
  try {
    dbUser = await getDbUser(session);
  } catch (err) {
    console.warn("getDbUser failed in /api/auth/me — falling back to email id", err);
  }

  const { email, name, image, role, labId, techCellId, permissions } = session.user;
  return NextResponse.json({
    user: {
      id: dbUser?.id ?? email,
      email,
      name,
      image,
      role,
      labId,
      techCellId,
      permissions,
    },
  });
}
