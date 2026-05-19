"use client";

import { useState, useEffect } from "react";
import { formatBytes } from "@/lib/catalog-types";
import type { FileTreeNode } from "@/lib/catalog-types";

interface FileTreeProps {
  repoName: string;
  prefix: string;
  branch?: string;
  onFileClick: (path: string) => void;
}

function FileTreeItem({
  node,
  repoName,
  refName,
  onFileClick,
  depth = 0,
}: {
  node: FileTreeNode;
  repoName: string;
  refName: string;
  onFileClick: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);

  const isDir = node.type === "directory";

  const handleClick = () => {
    if (isDir) {
      setExpanded(!expanded);
    } else {
      onFileClick(node.path);
    }
  };

  const downloadUrl = !isDir
    ? `/api/catalog/lakefs/${repoName}/download?path=${encodeURIComponent(node.path)}&ref=${encodeURIComponent(refName)}`
    : undefined;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 px-2 hover:bg-gray-100 rounded cursor-pointer group"
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          <svg
            className={`w-4 h-4 text-teal-500 transition-transform ${expanded ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        ) : (
          <svg
            className="w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        )}

        <span
          className={`text-sm flex-1 truncate ${
            isDir ? "font-medium text-gray-800" : "text-gray-600"
          }`}
        >
          {node.name}
        </span>

        {!isDir && node.size != null && (
          <span className="text-xs text-gray-400 mr-1">
            {formatBytes(node.size)}
          </span>
        )}

        {!isDir && downloadUrl && (
          <a
            href={downloadUrl}
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-teal-600 transition-all"
            title="다운로드"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </a>
        )}
      </div>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              repoName={repoName}
              refName={refName}
              onFileClick={onFileClick}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({
  repoName,
  prefix,
  branch = "main",
  onFileClick,
}: FileTreeProps) {
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError(false);
    const sp = new URLSearchParams({ prefix, ref: branch });
    fetch(`/api/catalog/lakefs/${repoName}/files?${sp}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed");
        return r.json();
      })
      .then((data) => setTree(data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, [repoName, prefix, branch]);

  if (isLoading) {
    return (
      <div className="text-sm text-gray-400 py-4">파일 목록을 불러오는 중...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 py-4">
        파일 목록을 불러오지 못했습니다.
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-sm text-gray-400 py-4">파일이 없습니다.</div>
    );
  }

  return (
    <div className="font-mono">
      {tree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          repoName={repoName}
          refName={branch}
          onFileClick={onFileClick}
        />
      ))}
    </div>
  );
}
