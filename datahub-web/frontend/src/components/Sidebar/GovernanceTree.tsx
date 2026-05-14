// Governance 섹션의 트리 — 홈 항목 + CTA + 그룹들.
//   adminOnly 그룹은 isAdmin=false 면 렌더 자체에서 제외 (DOM 미포함).

import type { MenuGroup as MenuGroupData } from "./sidebar.config";
import { GOVERNANCE_GROUPS, GOVERNANCE_HOME } from "./sidebar.config";
import { MenuGroup } from "./MenuGroup";
import { MenuItem } from "./MenuItem";
import { SidebarCTA } from "./SidebarCTA";

interface Props {
  isAdmin: boolean;
}

export function GovernanceTree({ isAdmin }: Props) {
  const visibleGroups: MenuGroupData[] = GOVERNANCE_GROUPS.filter(
    (g) => !g.adminOnly || isAdmin,
  );
  return (
    <div className="flex flex-col gap-1">
      <MenuItem item={GOVERNANCE_HOME} />
      <div className="mt-1">
        <SidebarCTA />
      </div>
      <div>
        {visibleGroups.map((g) => (
          <MenuGroup key={g.id} group={g} />
        ))}
      </div>
    </div>
  );
}
