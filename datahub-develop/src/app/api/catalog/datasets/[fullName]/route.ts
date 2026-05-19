import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getTable, updateMetadata } from "@/lib/platform-client";
import { tableInfoToMetadata } from "@/lib/catalog-types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fullName: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { fullName } = await params;
    const decoded = decodeURIComponent(fullName);
    const table = await getTable(token, decoded);
    const metadata = tableInfoToMetadata(table);
    return NextResponse.json({ ...table, metadata });
  } catch (err) {
    console.error("getTable error:", err);
    return NextResponse.json({ error: "Failed to get dataset" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ fullName: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { fullName } = await params;
    const decoded = decodeURIComponent(fullName);
    const body = await request.json();
    await updateMetadata(token, decoded, body);
    const table = await getTable(token, decoded);
    const metadata = tableInfoToMetadata(table);
    return NextResponse.json({ ...table, metadata });
  } catch (err) {
    console.error("updateMetadata error:", err);
    return NextResponse.json({ error: "Failed to update dataset" }, { status: 500 });
  }
}
