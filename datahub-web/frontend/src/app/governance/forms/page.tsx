// 화면 5: 데이터 거버넌스 문서 서식 모음 — 신청서 양식 카드 목록.
// (내 문서 목록은 /governance/forms/my 로 분리 — 사이드바 별도 카테고리)
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { FORM_TYPE_LABELS } from "@/lib/utils";
import { FORM_SCHEMAS } from "@/lib/formSchemas";

const TYPES = Object.values(FORM_SCHEMAS).map((s) => s.type);

export default function FormsIndexPage() {
  return (
    <div>
      <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "데이터 거버넌스 문서 서식 모음" }]} />
      <h1 className="text-3xl font-bold tracking-tight">데이터 거버넌스 문서 서식 모음</h1>
      <p className="mt-2 text-sm text-gray-500">
        작성할 품의서 종류를 선택하세요. 작성 완료 후 전자결재를 통해 신청을 완료해 주세요.
      </p>

      <div className="mt-6 space-y-3">
        {TYPES.map((t) => {
          const schema = FORM_SCHEMAS[t];
          return (
            <Link
              key={t}
              href={`/governance/forms/${t}/new`}
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white px-5 py-4 transition hover:border-brand/40 hover:shadow-sm"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <FileText size={18} className="mt-0.5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{FORM_TYPE_LABELS[t]}</div>
                  {schema.description && (
                    <p className="mt-1 text-xs text-gray-500">{schema.description}</p>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
