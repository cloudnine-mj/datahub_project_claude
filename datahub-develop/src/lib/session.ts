import { cookies } from "next/headers";

const PLATFORM_API_URL =
  process.env.PLATFORM_API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ||
  "http://localhost:8643";

export type PlatformRole = "USER" | "ADMIN";

export interface PlatformPermission {
  repo: string;
  role: string;
}

export interface PlatformSessionUser {
  email: string;
  name?: string | null;
  image?: string | null;
  role: PlatformRole;
  labId: string | null;
  techCellId: string | null;
  permissions: PlatformPermission[];
}

export interface PlatformSession {
  user: PlatformSessionUser;
  accessToken: string;
}

/**
 * Local-dev only — datahub-api 없이 UI 검증할 때 사용.
 * `.env` 에 `DEV_AUTH_BYPASS=1` 이면 mock 세션 반환. 운영 환경 절대 X.
 */
function devBypassSession(): PlatformSession | null {
  if (process.env.DEV_AUTH_BYPASS !== "1") return null;
  const email = process.env.DEV_AUTH_EMAIL ?? "dev@localhost";
  const name = process.env.DEV_AUTH_NAME ?? email.split("@")[0];
  const role: PlatformRole =
    (process.env.DEV_AUTH_ROLE as PlatformRole | undefined) ?? "ADMIN";
  return {
    accessToken: "dev-bypass-token",
    user: {
      email,
      name,
      image: null,
      role,
      labId: null,
      techCellId: null,
      permissions: [],
    },
  };
}

export async function getPlatformToken(): Promise<string | null> {
  if (process.env.DEV_AUTH_BYPASS === "1") return "dev-bypass-token";
  return cookies().get("platform_token")?.value ?? null;
}

export async function getSession(): Promise<PlatformSession | null> {
  const dev = devBypassSession();
  if (dev) return dev;

  const token = await getPlatformToken();
  if (!token) return null;

  const res = await fetch(`${PLATFORM_API_URL}/api/v1/auth/session`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    email: string;
    name?: string | null;
    picture?: string | null;
    role?: PlatformRole;
    lab_id?: string | null;
    tech_cell_id?: string | null;
    permissions?: PlatformPermission[];
  };

  return {
    accessToken: token,
    user: {
      email: data.email,
      name: data.name ?? data.email.split("@")[0],
      image: data.picture ?? null,
      role: data.role ?? "USER",
      labId: data.lab_id ?? null,
      techCellId: data.tech_cell_id ?? null,
      permissions: data.permissions ?? [],
    },
  };
}
