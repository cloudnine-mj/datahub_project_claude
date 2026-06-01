// 참조자 카드 — 협의 단계 페이지. 신청 정보 카드 아래, 최종 협의 내용 위.
//   칩 목록 + [+ 참조자 추가] → 담당자 지정과 동일한 모달(이름+이메일). 인원 뱃지.

"use client";

import { useEffect, useState } from "react";
import {
  readCcUsers,
  writeCcUsers,
  type CcUser,
} from "@/lib/governance/cc-users-storage";
import { CcUsersInput } from "@/components/governance/CcUsersInput";

interface Props {
  formId: string;
  applicationType?: string;
}

export function CcUsersCard({ formId, applicationType = "service" }: Props) {
  const [users, setUsers] = useState<CcUser[]>([]);

  useEffect(() => {
    setUsers(readCcUsers(formId, applicationType));
  }, [formId, applicationType]);

  function onChange(next: CcUser[]): void {
    setUsers(next);
    writeCcUsers(formId, applicationType, next);
  }

  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          참조자
        </h3>
        {users.length > 0 && (
          <span
            className="inline-flex items-center text-[10px]"
            style={{
              background: "var(--color-background-secondary,#f3f4f6)",
              color: "var(--color-text-secondary,#6b7280)",
              borderRadius: 6,
              padding: "1px 7px",
            }}
          >
            {users.length}명
          </span>
        )}
      </header>

      <CcUsersInput mode="card" value={users} onChange={onChange} />
    </section>
  );
}
