"use client";

import { useState, useRef, useEffect } from "react";
import CodeBlock from "./CodeBlock";

interface DownloadButtonProps {
  repoName: string;
  tableName: string;
  fullName: string;
  /** group namespace for 3-component dh:// URI: dh://{group}/{repoName}/ */
  group?: string;
}

export default function DownloadButton({
  repoName,
  tableName,
  fullName,
  group,
}: DownloadButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fullRepoName = group ? `${group}/${repoName}` : repoName;
  const cliCommand = `datahub cp dh://${fullRepoName}/ ./data/${tableName}/ -b main`;
  const sdkCode = `from datahub import DataClient

client = DataClient()
client.download("${fullRepoName}", "/", "./data/${tableName}/")`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
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
        다운로드
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[480px] bg-white rounded-lg shadow-xl border border-gray-200 p-5 z-50">
          <h4 className="text-sm font-semibold text-gray-800 mb-3">
            다운로드 방법
          </h4>

          <CodeBlock title="CLI" code={cliCommand} />
          <CodeBlock title="Python SDK" code={sdkCode} />

          <p className="text-xs text-gray-400 mt-2">
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              {fullName}
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
