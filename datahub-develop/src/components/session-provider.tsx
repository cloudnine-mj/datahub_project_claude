"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

export interface PlatformSessionUser {
  id: string;           // Web 쪽 DB 사용자 id (없으면 email 으로 채움)
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
  labId: string | null;
  techCellId: string | null;
  permissions: { repo: string; role: string }[];
}

// next-auth 의 useSession 과 동일한 shape 을 유지 — 호출부 수정 최소화
interface SessionShape {
  user: PlatformSessionUser;
}

interface SessionContextValue {
  data: SessionShape | null;
  status: SessionStatus;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  data: null,
  status: "loading",
  refresh: async () => {},
});

export function PlatformSessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SessionShape | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        setStatus("unauthenticated");
        return;
      }
      const body = (await res.json()) as { user: PlatformSessionUser | null };
      if (!body.user) {
        setData(null);
        setStatus("unauthenticated");
        return;
      }
      // id 필드가 API 응답에 없을 수 있으므로 email 로 fallback
      const user: PlatformSessionUser = {
        ...body.user,
        id: (body.user as { id?: string }).id ?? body.user.email,
      };
      setData({ user });
      setStatus("authenticated");
    } catch {
      setData(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SessionContext.Provider value={{ data, status, refresh: load }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export async function signOut(options?: { callbackUrl?: string }) {
  const callbackUrl = options?.callbackUrl ?? "/";
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = callbackUrl;
}
