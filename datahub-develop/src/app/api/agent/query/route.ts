import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { callIntelligence } from "@/lib/intelligence-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { message, model, history } = await request.json();
    const res = await callIntelligence({
      userToken: token,
      path: "/query",
      body: { message, model: model || "gpt-4o", history: history || [] },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Agent error: ${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}` },
        { status: res.status },
      );
    }
    return NextResponse.json(res.data, { status: res.status });
  } catch (err) {
    console.error("Agent query proxy error:", err);
    return NextResponse.json({ error: "에이전트 응답에 실패했습니다." }, { status: 500 });
  }
}
