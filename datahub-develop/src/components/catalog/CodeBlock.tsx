"use client";

import { useState } from "react";

export default function CodeBlock({
  title,
  code,
}: {
  title: string;
  code: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-gray-800 text-gray-100 rounded-lg p-4 text-sm overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
}
