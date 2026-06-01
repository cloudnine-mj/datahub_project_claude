// 신청 정보 표용 참조자 인라인 편집 위젯 — sessionStorage(dh:gov:cc-users:{formId})와 연동.
//   칩 목록 + [+ 참조자 추가] 모달(이름+이메일). 신청 단계 상세·협의 단계 신청 정보 카드 공용.
//   Phase 1: 권한 분기 없음 — 누구나 추가/제거. 표의 참조자 행만 편집 허용(다른 필드는 읽기 전용).

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

  function onChange(next: CcUser[]): void {
    setUsers(next);
    writeCcUsers(formId, applicationType, next);
  }

  return <CcUsersInput mode="inline" value={users} onChange={onChange} />;
}
