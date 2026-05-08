"use client";

/**
 * 우측 상단 사용자 아바타 + 드롭다운 메뉴.
 *
 * 항목: 이메일 / Settings / Access Tokens / Sign out
 * 외부 클릭 시 자동 닫힘.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Key, LogOut, Settings as SettingsIcon, User as UserIcon } from "lucide-react";
import { api, type Me } from "@/lib/api";

interface Props {
  me: Me | null;
}

export function UserMenu({ me }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await api.logout();
    router.push("/signin");
  }

  const initial = (me?.user.name?.trim()?.[0] ?? "?").toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="사용자 메뉴"
        className="grid h-9 w-9 place-items-center rounded-full bg-brand text-sm font-bold text-white transition hover:bg-brand-dark"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="truncate text-sm text-gray-500">
              {me?.user.email ?? "로그인되지 않음"}
            </div>
          </div>
          <ul className="py-1">
            <MenuItem href="/settings" icon={<UserIcon size={16} />}>
              Settings
            </MenuItem>
            <MenuItem href="/access-tokens" icon={<Key size={16} />}>
              Access Tokens
            </MenuItem>
          </ul>
          <div className="border-t border-gray-100 py-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        {icon}
        {children}
      </Link>
    </li>
  );
}
