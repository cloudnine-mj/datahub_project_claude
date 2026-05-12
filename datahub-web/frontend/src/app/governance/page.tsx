// Governance 인덱스 — 3개 카드 (정책 + 프로세스는 통합 자료실로 합침)
import Link from "next/link";
import { BookOpen, FileEdit, FolderOpen, ArrowRight } from "lucide-react";

const CARDS = [
  {
    href: "/governance/info",
    icon: BookOpen,
    title: "정책 / 프로세스 안내",
    desc: "데이터 관리 정책과 데이터 제작·요청 프로세스를 한 곳에서 확인합니다.",
  },
  {
    href: "/governance/forms",
    icon: FileEdit,
    title: "데이터 거버넌스 문서 서식 모음",
    desc: "각종 신청서 및 품의서 양식을 작성합니다.",
  },
  {
    href: "/governance/forms/my",
    icon: FolderOpen,
    title: "내 문서 목록",
    desc: "내가 제출한 신청서의 진행 상태를 확인합니다.",
  },
];

export default function GovernancePage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Governance</h1>
      <p className="mt-2 text-sm text-gray-500">데이터 거버넌스 정책 및 프로세스를 확인하세요.</p>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group rounded-lg border border-gray-200 bg-white p-6 transition hover:border-brand/40 hover:shadow-sm"
            >
              <div className="grid h-10 w-10 place-items-center rounded-md bg-brand/10 text-brand">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 text-lg font-bold tracking-tight">{c.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{c.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                바로가기 <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
