import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { callIntelligence } from "@/lib/intelligence-client";

export const dynamic = "force-dynamic";

/**
 * POST — AI 데이터카드 생성 프록시.
 * data-intelligence-api 의 POST /datacard 를 호출하여 DATACARD.md 를 자동 생성 후 레포에 업로드합니다.
 */
export async function POST(request: NextRequest) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    // body: { owner, repo }
    const res = await callIntelligence({ userToken: token, path: "/datacard", body });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Agent error: ${typeof res.data === "string" ? res.data : JSON.stringify(res.data)}` },
        { status: res.status },
      );
    }
    return NextResponse.json(res.data, { status: res.status });
  } catch (err) {
    console.error("AI datacard proxy error:", err);
    return NextResponse.json({ error: "AI 데이터카드 생성에 실패했습니다." }, { status: 500 });
  }
}
