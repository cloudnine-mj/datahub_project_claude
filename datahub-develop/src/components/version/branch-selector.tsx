"use client";

import { useState } from "react";
import { GitBranch } from "lucide-react";

interface BranchSelectorProps {
  branches: string[];
  defaultBranch?: string;
  onBranchChange?: (branch: string) => void;
}

export function BranchSelector({ branches, defaultBranch = "main", onBranchChange }: BranchSelectorProps) {
  const [selected, setSelected] = useState(defaultBranch);

  const handleSelect = (branch: string) => {
    setSelected(branch);
    onBranchChange?.(branch);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-4 w-4 text-text-secondary" />
        <span className="text-sm font-medium text-text-secondary">Branch:</span>
      </div>
      <div className="flex gap-2">
        {branches.map((b) => (
          <button
            key={b}
            onClick={() => handleSelect(b)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              b === selected
                ? "bg-text-primary text-white"
                : "border border-dh-border bg-bg-surface text-text-secondary hover:bg-white"
            }`}
          >
            {b}
          </button>
        ))}
      </div>
    </div>
  );
}
