import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getFileContent } from "@/lib/platform-client";

export const dynamic = "force-dynamic";

const DATACARD_PATH = "DATACARD.md";
const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL || "http://localhost:8643";
const BASE = `${PLATFORM_API_URL.replace(/\/$/, "")}/api/v1`;

function repoApiPath(repo: string): string {
  return repo.split("/").map(encodeURIComponent).join("/");
}

/** GET — DATACARD.md 내용 조회 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ group: string; repo: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const repoKey = `${group}/${repo}`;
  const ref = request.nextUrl.searchParams.get("ref") || "main";

  try {
    const data = await getFileContent(token, repoKey, ref, DATACARD_PATH, 512_000);
    return NextResponse.json({ content: data.content, exists: true });
  } catch {
    return NextResponse.json({ content: "", exists: false });
  }
}

/** PUT — DATACARD.md 저장 (upload init → signed URL PUT → upload complete) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ group: string; repo: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const repoKey = `${group}/${repo}`;
  const { content } = await request.json();
  const branch = "main";
  const contentBytes = new TextEncoder().encode(content);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 1) Upload init — get signed URL
  const initRes = await fetch(`${BASE}/repos/${repoApiPath(repoKey)}/upload/init`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      branch,
      files: [{ remote_path: DATACARD_PATH, size_bytes: contentBytes.length }],
      commit_message: "Update DATACARD.md",
    }),
  });
  if (!initRes.ok) {
    const err = await initRes.text();
    return NextResponse.json({ error: `Upload init failed: ${err}` }, { status: 500 });
  }
  const { session_id, signed_urls } = await initRes.json();
  const signedUrl = signed_urls[0].signed_url;

  // 2) PUT file content to signed URL
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: contentBytes,
  });
  if (!putRes.ok) {
    return NextResponse.json({ error: "Failed to upload file to GCS" }, { status: 500 });
  }

  // 3) Upload complete — commit
  const completeRes = await fetch(`${BASE}/repos/${repoApiPath(repoKey)}/upload/complete`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      session_id,
      files: [{
        remote_path: DATACARD_PATH,
        size_bytes: contentBytes.length,
        checksum: "",
      }],
    }),
  });
  if (!completeRes.ok) {
    const err = await completeRes.text();
    return NextResponse.json({ error: `Upload complete failed: ${err}` }, { status: 500 });
  }

  const result = await completeRes.json();
  return NextResponse.json({ status: "saved", commit_id: result.commit_id });
}
