// 신청 정보 표용 참조자 인라인 표시 — sessionStorage(dh:gov:cc-users:{formId})에서 읽어
//   파란 칩으로 렌더. 읽기 전용(상세 표). 비어 있으면 "-".

"use client";

import { useEffect, useState } from "react";
import { readCcUsers, type CcUser } from "@/lib/governance/cc-users-storage";

interface Props {
  formId: string;
  applicationType: string;
}

export function CcUsersInlineView({ formId, applicationType }: Props) {
  const [users, setUsers] = useState<CcUser[]>([]);

  useEffect(() => {
    setUsers(readCcUsers(formId, applicationType));
    const onFocus = () => setUsers(readCcUsers(formId, applicationType));
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [formId, applicationType]);

  if (users.length === 0) return <span className="text-gray-400">-</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {users.map((u) => (
        <span
          key={u.email}
          className="inline-flex items-center text-[11px]"
          style={{
            background: "#E6F1FB",
            color: "#0C447C",
            borderRadius: 14,
            padding: "3px 10px",
          }}
          title={u.email || undefined}
        >
          {u.name}
        </span>
      ))}
    </div>
  );
}
