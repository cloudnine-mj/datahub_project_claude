// 메뉴 그룹 — 그룹 헤더 라벨 + 항목 리스트. locked=true 면 헤더 옆 자물쇠 아이콘.
//   adminOnly 그룹은 Sidebar 상위에서 권한 검사 후 아예 렌더되지 않음 (DOM 제외).
//   폰트 weight 는 400/500 만.

import { Lock } from "lucide-react";
import type { MenuGroup as MenuGroupData } from "./sidebar.config";
import { MenuItem } from "./MenuItem";

interface Props {
  group: MenuGroupData;
}

export function MenuGroup({ group }: Props) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="flex items-center gap-1 px-2.5 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        <span>{group.label}</span>
        {group.locked && <Lock size={11} className="text-gray-400 dark:text-gray-500" />}
      </div>
      <ul className="flex flex-col gap-0.5">
        {group.items.map((item) => (
          <li key={item.id}>
            <MenuItem item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}
