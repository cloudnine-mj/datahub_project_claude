"use client";

import * as React from "react";
import { Globe, Lock, EyeOff } from "lucide-react";
import type { VisibilityMode } from "@/lib/platform-client";

/**
 * Repository visibility 배지.
 *
 * governance:
 *   - public         → 🌐 Public
 *   - fine_grained   → 🔒 Fine-grained (gated; capabilities partial)
 *   - private        → 🔒 Private (members only)
 */
export function VisibilityBadge({
  visibility,
  size = "sm",
}: {
  visibility: VisibilityMode | string | undefined;
  size?: "sm" | "md";
}) {
  const iconCls = size === "md" ? "h-3.5 w-3.5" : "h-3 w-3";
  const baseCls = "flex items-center gap-1";

  if (visibility === "public") {
    return (
      <span className={baseCls}>
        <Globe className={iconCls} /> Public
      </span>
    );
  }
  if (visibility === "fine_grained") {
    return (
      <span className={baseCls} title="Fine-grained: 비멤버에게 일부 capability 만 공개">
        <EyeOff className={iconCls} /> Fine-grained
      </span>
    );
  }
  return (
    <span className={baseCls}>
      <Lock className={iconCls} /> Private
    </span>
  );
}
