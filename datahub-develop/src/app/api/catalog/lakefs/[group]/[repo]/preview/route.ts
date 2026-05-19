import { NextRequest, NextResponse } from "next/server";
import { getPlatformToken } from "@/lib/session";
import { getFileContent } from "@/lib/platform-client";
import type { DataPreview } from "@/lib/catalog-types";

export const dynamic = "force-dynamic";

const MAX_ROWS = 20;

function detectFormat(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) return "jsonl";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".tsv")) return "tsv";
  return "unknown";
}

function parseJSON(content: string, truncated: boolean): { columns: string[]; rows: Record<string, unknown>[] } {
  let data: unknown[];
  try {
    data = JSON.parse(content);
  } catch {
    if (!truncated) throw new Error("Invalid JSON");
    const lastBrace = content.lastIndexOf("}");
    if (lastBrace === -1) throw new Error("No complete JSON object found");
    const lastBracket = content.indexOf("[");
    if (lastBracket === -1) throw new Error("No JSON array found");
    const trimmed = content.slice(0, lastBrace + 1) + "]";
    data = JSON.parse(trimmed);
  }
  if (!Array.isArray(data)) throw new Error("Expected JSON array");
  const rows = data.slice(0, MAX_ROWS) as Record<string, unknown>[];
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

function parseJSONL(content: string): { columns: string[]; rows: Record<string, unknown>[] } {
  const lines = content.split("\n").filter((l) => l.trim());
  const rows: Record<string, unknown>[] = [];
  for (const line of lines.slice(0, MAX_ROWS)) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

function parseCSV(content: string, delimiter = ","): { columns: string[]; rows: Record<string, unknown>[] } {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return { columns: [], rows: [] };

  const columns = lines[0].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
  const rows: Record<string, unknown>[] = [];

  for (const line of lines.slice(1, MAX_ROWS + 1)) {
    const values = line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      row[col] = values[i] ?? "";
    });
    rows.push(row);
  }

  return { columns, rows };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ group: string; repo: string }> },
) {
  const token = await getPlatformToken();
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { group, repo } = await params;
  const repoKey = `${group}/${repo}`;
  const sp = request.nextUrl.searchParams;
  const path = sp.get("path") || "";
  const ref = sp.get("ref") || "main";

  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const format = detectFormat(path);
  if (format === "unknown") {
    return NextResponse.json({
      format: "unknown",
      columns: [],
      rows: [],
      truncated: false,
      filePath: path,
      error: "미리보기를 지원하지 않는 파일 형식입니다.",
    });
  }

  try {
    const { content, truncated } = await getFileContent(token, repoKey, ref, path);

    let parsed: { columns: string[]; rows: Record<string, unknown>[] };
    if (format === "json") {
      parsed = parseJSON(content, truncated);
    } else if (format === "jsonl") {
      parsed = parseJSONL(content);
    } else if (format === "tsv") {
      parsed = parseCSV(content, "\t");
    } else {
      parsed = parseCSV(content);
    }

    const preview: DataPreview = {
      format,
      columns: parsed.columns,
      rows: parsed.rows,
      truncated,
      filePath: path,
    };

    return NextResponse.json(preview);
  } catch (err) {
    console.error("preview error:", err);
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
