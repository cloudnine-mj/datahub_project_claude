"use client";

import { useState, useEffect } from "react";
import type { CommitInfo } from "@/lib/catalog-types";

interface CommitTimelineProps {
  repoName: string;
  branch?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommitTimeline({
  repoName,
  branch = "main",
}: CommitTimelineProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(false);
    const sp = new URLSearchParams({ ref: branch });
    fetch(`/api/catalog/lakefs/${repoName}/commits?${sp}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => setCommits(data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [repoName, branch]);

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400 py-4">
        버전 기록을 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 py-4">
        버전 기록을 불러오지 못했습니다.
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4">커밋 기록이 없습니다.</div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
              날짜
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
              커밋 ID
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
              메시지
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
              작성자
            </th>
          </tr>
        </thead>
        <tbody>
          {commits.map((commit) => (
            <tr
              key={commit.id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {formatDate(commit.date)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  {commit.isMerge && (
                    <svg
                      className="w-3.5 h-3.5 text-purple-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="Merge commit"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7v8a2 2 0 002 2h6M8 7V5m0 2H6m10 10v2m0-2h2"
                      />
                    </svg>
                  )}
                  <code className="text-teal-600 text-xs">
                    {commit.shortId}
                  </code>
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700 max-w-md truncate">
                {commit.message}
              </td>
              <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                {commit.userEmail || "\u2014"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
