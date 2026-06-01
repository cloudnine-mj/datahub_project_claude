// 참조자 카드 — 협의 단계 페이지. 신청 정보 카드 아래, 최종 협의 내용 위에 위치.
//   3상태: 참조자 있음 / 없음 / 입력 모드. 입력 모드면 테두리 강조 + '추가 중' 뱃지.
//   본문(칩·점선버튼·입력영역)은 CardModeBody 가, 헤더·상태 전환은 본 카드가 담당.

"use client";

import { useEffect, useState } from "react";
import { readCcUsers, writeCcUsers } from "@/lib/governance/cc-users-storage";
import { CardModeBody } from "@/components/governance/CcUsersInput";

interface Props {
  formId: string;
  /** 참조자 키 분리용 — formId 가 있으면 미사용이지만 시그니처 일관성 위해 받는다. */
  applicationType?: string;
}

export function CcUsersCard({ formId, applicationType = "service" }: Props) {
  const [users, setUsers] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setUsers(readCcUsers(formId, applicationType));
  }, [formId, applicationType]);

  function onChange(next: string[]): void {
    setUsers(next);
    writeCcUsers(formId, applicationType, next);
  }

  return (
    <section
      className="rounded-xl border-[0.5px] bg-white p-5 dark:bg-gray-900"
      style={{
        borderColor: editing ? "#EFC4B9" : "var(--color-border-tertiary,#e5e7eb)",
      }}
    >
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
        {editing && (
          <span
            className="inline-flex items-center text-[10px]"
            style={{ background: "#FCF3F0", color: "#993C1D", borderRadius: 6, padding: "1px 7px" }}
          >
            추가 중
          </span>
        )}
      </header>

      <CardModeBody
        value={users}
        onChange={onChange}
        editing={editing}
        onEditingChange={setEditing}
      />
    </section>
  );
}
