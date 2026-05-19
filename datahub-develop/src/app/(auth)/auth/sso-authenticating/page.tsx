"use client";

import { Loader2 } from "lucide-react";

export default function SSOAuthenticatingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-surface">
      <div className="text-center">
        <div className="mb-6 inline-flex items-center gap-2">
          <span className="font-heading text-xl font-bold text-brand">LGAIR</span>
          <span className="font-heading text-xl font-semibold text-text-primary">DataHub</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-sm font-medium text-text-primary">인증 중입니다...</p>
          <p className="text-xs text-text-muted">잠시만 기다려주세요.</p>
        </div>
      </div>
    </div>
  );
}
