"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FileText,
  Download,
  ChevronRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/catalog-types";
import type { DataPreview } from "@/lib/catalog-types";

const PREVIEWABLE_EXTS = ["csv", "tsv", "json", "jsonl", "ndjson"];

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export default function BlobPage() {
  const { group, repo, path: rawPath } = useParams<{
    group: string;
    repo: string;
    path: string[];
  }>();

  const pathSegments: string[] = Array.isArray(rawPath) ? rawPath : rawPath ? [rawPath] : [];
  const branch = pathSegments[0] ?? "main";
  const filePath = pathSegments.slice(1).join("/");
  const fileName = filePath.split("/").pop() ?? filePath;
  const parentPath = filePath.includes("/") ? filePath.split("/").slice(0, -1).join("/") : "";
  const ext = getExt(fileName);
  const browserBase = `/${group}/${repo}/browser/${branch}`;

  const downloadHref = `/api/catalog/lakefs/${group}/${repo}/download?path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(branch)}`;

  const [preview, setPreview] = useState<DataPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const canPreview = PREVIEWABLE_EXTS.includes(ext);

  useEffect(() => {
    if (!canPreview) return;
    setPreviewLoading(true);
    setPreviewError(null);
    fetch(
      `/api/catalog/lakefs/${group}/${repo}/preview?path=${encodeURIComponent(filePath)}&ref=${encodeURIComponent(branch)}`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: DataPreview & { error?: string }) => {
        if (data.error) {
          setPreviewError(data.error);
        } else {
          setPreview(data);
          setShowPreview(true);
        }
      })
      .catch(() => setPreviewError("미리보기를 불러올 수 없습니다."))
      .finally(() => setPreviewLoading(false));
  }, [repo, filePath, branch, canPreview]);

  return (
    <div className="max-w-4xl space-y-4">
      {/* Sub Tabs */}
      <div className="flex gap-1 border-b border-dh-border">
        <Link
          href={`/${group}/${repo}/browser/main`}
          className="px-4 py-2 text-sm font-medium border-b-2 border-brand text-brand"
        >
          Files
        </Link>
        <Link
          href={`/${group}/${repo}/versions`}
          className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-text-secondary hover:text-text-primary"
        >
          Versions
        </Link>
      </div>

      {/* Breadcrumb nav */}
      <div className="flex items-center gap-1 text-sm text-text-secondary">
        <Link href={browserBase} className="flex items-center gap-1 hover:text-text-primary">
          <ArrowLeft className="h-3.5 w-3.5" />
          {repo}
        </Link>
        {parentPath &&
          parentPath.split("/").map((seg, i, arr) => {
            const href = `${browserBase}/${arr.slice(0, i + 1).join("/")}`;
            return (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                <Link href={href} className="hover:text-text-primary">
                  {seg}
                </Link>
              </span>
            );
          })}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-text-primary">{fileName}</span>
      </div>

      {/* File info card */}
      <div className="rounded-xl border border-dh-border bg-white">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-dh-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-surface border border-dh-border shrink-0">
              <FileText className="h-4.5 w-4.5 text-text-muted" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-text-primary truncate">{fileName}</p>
              <p className="text-xs text-text-muted truncate">{filePath}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canPreview && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowPreview((v) => !v)}
                disabled={previewLoading || !!previewError}
              >
                {previewLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Table2 className="h-3.5 w-3.5" />
                )}
                {showPreview ? "Hide Preview" : "Preview"}
              </Button>
            )}
            <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white gap-1.5">
              <a href={downloadHref}>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          </div>
        </div>

        {/* Preview error */}
        {previewError && canPreview && (
          <div className="flex items-center gap-2 px-5 py-3 text-sm text-amber-700 bg-amber-50 border-b border-dh-border">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {previewError}
          </div>
        )}

        {/* Preview table */}
        {showPreview && preview && preview.columns.length > 0 && (
          <div>
            <div className="px-5 py-2.5 border-b border-dh-border bg-bg-surface flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Preview — {preview.format.toUpperCase()}
              </span>
              {preview.truncated && (
                <span className="text-xs text-text-muted">처음 20행만 표시</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-surface border-b border-dh-border">
                  <tr>
                    {preview.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left font-medium text-text-secondary whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dh-border">
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-bg-surface">
                      {preview.columns.map((col) => (
                        <td
                          key={col}
                          className="px-4 py-2 text-text-primary truncate max-w-[200px]"
                        >
                          {String(row[col] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Non-previewable placeholder */}
        {!canPreview && (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <FileText className="h-10 w-10 text-text-muted" />
            <p className="text-sm text-text-secondary">
              이 파일 형식은 미리보기를 지원하지 않습니다.
            </p>
            <Button asChild size="sm" className="bg-brand hover:bg-brand/90 text-white gap-1.5">
              <a href={downloadHref}>
                <Download className="h-3.5 w-3.5" />
                파일 다운로드
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
