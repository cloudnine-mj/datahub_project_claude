"use client";

import { useState, useEffect } from "react";
import type { DataPreview } from "@/lib/catalog-types";

interface DataPreviewTableProps {
  repoName: string;
  filePath: string | null;
  branch?: string;
}

function truncateCell(value: unknown, maxLen = 100): string {
  const str = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return str.length > maxLen ? str.slice(0, maxLen) + "\u2026" : str;
}

export default function DataPreviewTable({
  repoName,
  filePath,
  branch = "main",
}: DataPreviewTableProps) {
  const [preview, setPreview] = useState<(DataPreview & { error?: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    setIsLoading(true);
    setError(false);
    setPreview(null);
    const sp = new URLSearchParams({ path: filePath, ref: branch });
    fetch(`/api/catalog/lakefs/${repoName}/preview?${sp}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => setPreview(data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [repoName, filePath, branch]);

  if (!filePath) {
    return (
      <div className="text-sm text-gray-400 py-4">
        파일 탭에서 파일을 선택하거나, 아래에서 파일을 선택하세요.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400 py-4">미리보기를 불러오는 중...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 py-4">
        미리보기를 불러오지 못했습니다.
      </div>
    );
  }

  if (!preview) return null;

  if (preview.error || preview.format === "unknown") {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        <svg
          className="w-8 h-8 mx-auto mb-2 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        {preview.error || "미리보기를 지원하지 않는 파일 형식입니다."}
      </div>
    );
  }

  if (preview.columns.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4">데이터가 비어 있습니다.</div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 font-mono truncate">
          {filePath}
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
          {preview.rows.length} rows
          {preview.truncated && " (truncated)"}
          {" \u00b7 "}
          {preview.format.toUpperCase()}
        </span>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100">
              {preview.columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left text-xs font-medium text-gray-600 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                {preview.columns.map((col) => (
                  <td
                    key={col}
                    className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate"
                    title={String(row[col] ?? "")}
                  >
                    {truncateCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
