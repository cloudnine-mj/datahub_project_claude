import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { searchTables } from "@/lib/platform-client";
import type { SearchParams } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  const params: SearchParams = {
    keyword: sp.get("keyword") || undefined,
    modality: sp.get("modality") || undefined,
    task: sp.get("task") || undefined,
    organization: sp.get("organization") || undefined,
    data_card_tier: sp.get("data_card_tier") || undefined,
  };

  try {
    const results = await searchTables(token, params);
    return NextResponse.json(results);
  } catch (err) {
    console.error("search error:", err);
    return NextResponse.json({ error: "Failed to search datasets" }, { status: 500 });
  }
}
