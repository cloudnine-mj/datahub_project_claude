import { NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getFilterOptions } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const options = await getFilterOptions(token);
    return NextResponse.json(options);
  } catch (err) {
    console.error("getFilterOptions error:", err);
    return NextResponse.json({ error: "Failed to get filter options" }, { status: 500 });
  }
}
