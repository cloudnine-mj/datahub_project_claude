// 화면 11: 신청서 제출 완료
"use client";

import Link from "next/link";
import { Check, FileEdit, List } from "lucide-react";

export default function Page() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-white">
        <Check size={36} strokeWidth={3} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">신청서가 제출되었습니다</h1>

      <div className="mt-8 flex gap-2">
        <Link
          href="/governance/forms"
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          <List size={14} /> 내 문서 목록 보기
        </Link>
        <Link
          href="/governance/forms"
          className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
        >
          <FileEdit size={14} /> 새 문서 작성
        </Link>
      </div>
    </div>
  );
}
