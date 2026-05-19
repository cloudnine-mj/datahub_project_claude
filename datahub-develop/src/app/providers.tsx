"use client";

import { PlatformSessionProvider } from "@/components/session-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <PlatformSessionProvider>{children}</PlatformSessionProvider>;
}
