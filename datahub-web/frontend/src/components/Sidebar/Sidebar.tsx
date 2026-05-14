// 사이드바 컨테이너 — 로고 / Top-level / Governance 트리.
//   - me 조회로 admin 권한 판정. admin 이 아니면 '관리' 그룹은 DOM 자체에서 제외.
//   - /governance 경로 진입 시 트리 자동 노출.
//   - 폰트 weight 는 400/500 만 사용 (font-normal, font-medium).

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type Me } from "@/lib/api";
import { TopLevelMenu, TOP_LEVEL_GOVERNANCE_PREFIX } from "./TopLevelMenu";
import { GovernanceTree } from "./GovernanceTree";

export function Sidebar() {
  const pathname = usePathname() ?? "";
  const [me, setMe] = useState<Me | null>(null);

  // 경로 전환마다 me 재조회 — Sidebar 는 루트 레이아웃에 마운트되어 remount 가 없으므로
  // 로그인/로그아웃 후 단순 push 만으로는 role 변화가 반영되지 않음.
  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, [pathname]);

  // 다른 탭/창에서 mock 계정 전환된 경우 동기화
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "datahub-user-email") {
        api.me().then(setMe).catch(() => setMe(null));
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isAdmin = me?.user.role === "admin";
  const showGovernanceTree =
    pathname === TOP_LEVEL_GOVERNANCE_PREFIX ||
    pathname.startsWith(TOP_LEVEL_GOVERNANCE_PREFIX + "/");

  return (
    <aside className="hidden w-60 shrink-0 border-r border-gray-200 bg-white md:flex md:flex-col dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="text-[15px] font-medium tracking-tight text-gray-900 dark:text-gray-100">
          LG AI DataHub
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        <TopLevelMenu />
        {showGovernanceTree && (
          <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
            <GovernanceTree isAdmin={isAdmin} />
          </div>
        )}
      </nav>
    </aside>
  );
}
