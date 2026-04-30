"use client";

import { Bell, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";

export function Topbar() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="relative w-[28rem] max-w-full">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="리포지토리, 데이터셋, 모델 검색..."
          className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-12 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-400">
          ⌘ K
        </kbd>
      </div>

      <div className="flex items-center gap-4">
        <button className="text-gray-500 hover:text-gray-700">
          <Bell size={18} />
        </button>
        <div className="h-6 w-px bg-gray-200" />
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gray-900 text-xs font-bold text-white">
            {me?.user.name
              .split(" ")
              .map((p) => p[0])
              .slice(0, 2)
              .join("") || "?"}
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold leading-tight">{me?.user.name ?? "..."}</div>
            <div className="text-xs capitalize text-gray-500">{me?.user.role ?? ""}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
