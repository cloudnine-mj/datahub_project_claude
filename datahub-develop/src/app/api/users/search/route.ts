import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { searchUsers } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json([]);

  try {
    const users = await searchUsers(token, q.trim());
    return NextResponse.json(users);
  } catch (err) {
    console.error("users search error:", err);
    return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
  }
}
