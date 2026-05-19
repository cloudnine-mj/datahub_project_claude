import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { listMeta } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["licenses", "tasks", "languages", "frameworks"] as const;
type MetaType = (typeof VALID_TYPES)[number];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  if (!VALID_TYPES.includes(type as MetaType)) {
    return NextResponse.json({ error: "Invalid meta type" }, { status: 400 });
  }

  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const items = await listMeta(token, type as MetaType);
    return NextResponse.json(items);
  } catch (err) {
    console.error(`meta/${type} error:`, err);
    return NextResponse.json({ error: "Failed to fetch meta" }, { status: 500 });
  }
}
