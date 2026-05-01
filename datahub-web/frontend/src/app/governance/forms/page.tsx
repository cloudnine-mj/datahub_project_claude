// 화면 5: 제작/활용 신청서 작성 — 5개 양식 카드 + 내 문서 목록
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import { api, type FormListItem } from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FORM_TYPE_LABELS, formatDate } from "@/lib/utils";
import { FORM_SCHEMAS } from "@/lib/formSchemas";

const TYPES = Object.values(FORM_SCHEMAS).map((s) => s.type);

export default function FormsIndexPage() {
  const [items, setItems] = useState<FormListItem[] | null>(null);

  useEffect(() => {
    api.listForms({ mine: true }).then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "제작/활용 신청서 작성" }]} />
      <h1 className="text-3xl font-bold tracking-tight">제작/활용 신청서 작성</h1>
      <p className="mt-2 text-sm text-gray-500">
        작성할 품의서 종류를 선택하세요. 작성 완료 후 전자결재를 통해 신청을 완료해 주세요.
      </p>

      <div className="mt-6 space-y-3">
        {TYPES.map((t) => (
          <Link
            key={t}
            href={`/governance/forms/${t}/new`}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-5 py-4 transition hover:border-brand/40 hover:shadow-sm"
          >
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-brand" />
              <span className="font-semibold">{FORM_TYPE_LABELS[t]}</span>
            </div>
            <ChevronRight size={16} className="text-gray-400" />
          </Link>
        ))}
      </div>

      <h2 className="mt-12 text-lg font-bold tracking-tight">내 문서 목록</h2>
      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">신청서 종류</th>
              <th className="px-6 py-3 font-medium">프로젝트명</th>
              <th className="w-32 px-6 py-3 font-medium">제출일</th>
              <th className="w-28 px-6 py-3 font-medium">Export</th>
            </tr>
          </thead>
          <tbody>
            {items === null ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">제출한 신청서가 없습니다.</td>
              </tr>
            ) : (
              items.map((it) => (
                <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">{FORM_TYPE_LABELS[it.form_type]}</td>
                  <td className="px-6 py-4">
                    <Link href={`/governance/forms/detail/${it.id}`} className="block hover:text-brand">
                      <div className="font-semibold">{it.project_name}</div>
                      <div className="text-xs text-gray-400">{it.request_no}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(it.submitted_at)}</td>
                  <td className="px-6 py-4">
                    <a
                      href={api.exportFormUrl(it.id)}
                      className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                    >
                      📄 Excel
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
