// 화면 11: 신청 제출 완료 — 다음 단계(전자결재) 안내 포함.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Download, ExternalLink, FileEdit, List } from "lucide-react";
import { api } from "@/lib/api";

export default function Page() {
  const sp = useSearchParams();
  const formId = sp?.get("id");
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center">
      <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-white">
        <Check size={36} strokeWidth={3} />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">신청이 제출되었습니다</h1>
      <p className="mt-2 text-sm text-gray-500">
        최종 승인을 받으려면 <strong className="font-semibold text-gray-700">전자결재 시스템에서 결재를 완료</strong>해 주세요.
      </p>

      {/* 다음 단계 가이드 */}
      <div className="mt-6 w-full rounded-lg border border-gray-200 bg-gray-50/40 p-5 text-left">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">다음 단계</h3>
        <ol className="mt-3 space-y-2.5 text-sm text-gray-700">
          <li className="flex gap-2">
            <span className="font-mono text-gray-400">1.</span>
            <span>
              <strong className="font-semibold">전자결재 시스템</strong>에서 결재선을 추가하고 상신해 주세요.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-gray-400">2.</span>
            <span>승인이 완료되면 거버넌스 관리자가 본 신청 상태를 <strong>승인 완료</strong>로 변경합니다.</span>
          </li>
          <li className="flex gap-2">
            <span className="font-mono text-gray-400">3.</span>
            <span>
              진행 상황은{" "}
              <Link href="/governance/forms/my" className="font-semibold text-blue-600 hover:underline">
                내 문서 목록
              </Link>{" "}
              의 상태 컬럼에서 확인 가능합니다.
            </span>
          </li>
        </ol>

        <div className="mt-4 border-t border-gray-200 pt-3">
          <a
            href="https://eas.lgmdi.com/service/contents.ncd"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
          >
            전자결재 시스템 바로가기 <ExternalLink size={11} />
          </a>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          href="/governance/forms/my"
          className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
        >
          <List size={14} /> 내 문서 목록 보기
        </Link>
        {formId && (
          <a
            href={api.exportFormUrl(Number(formId))}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            <Download size={14} /> Excel 다운로드
          </a>
        )}
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
