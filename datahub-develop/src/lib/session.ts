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

export async function getPlatformToken(): Promise<string | null> {
  return cookies().get("platform_token")?.value ?? null;
}

export async function getSession(): Promise<PlatformSession | null> {
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
