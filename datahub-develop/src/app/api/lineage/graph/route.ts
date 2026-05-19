import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getLineageGraph } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const graph = await getLineageGraph(token);
    return NextResponse.json(graph);
  } catch (err) {
    console.error("lineage graph error:", err);
    return NextResponse.json({ error: "Failed to fetch lineage graph" }, { status: 500 });
  }
}
