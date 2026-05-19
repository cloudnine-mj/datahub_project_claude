import Link from "next/link";
import {
  Plus,
  Search,
  ShieldCheck,
  Database,
  GitBranch,
  PackageOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const templates = [
  {
    id: "model-release",
    icon: PackageOpen,
    name: "Model Release Approval",
    description:
      "모델을 프로덕션에 배포하기 전 승인 절차를 정의합니다. 최소 2명의 리뷰어 승인이 필요합니다.",
    stages: ["Reviewer 검토", "Lead 승인", "QA 검토", "Release"],
    activeRequests: 8,
    color: "bg-blue-50 text-accent-blue",
  },
  {
    id: "data-access",
    icon: Database,
    name: "Data Access Control",
    description:
      "민감 데이터셋 접근 권한 요청 및 승인 프로세스. 데이터 분류에 따른 자동 라우팅이 적용됩니다.",
    stages: ["요청자 검증", "Owner 승인", "보안 검토"],
    activeRequests: 5,
    color: "bg-orange-50 text-accent-orange",
  },
  {
    id: "dataset-publishing",
    icon: ShieldCheck,
    name: "Dataset Publishing",
    description:
      "데이터셋을 조직 외부에 공개할 때 필요한 승인 워크플로우. 법무·보안 검토가 포함됩니다.",
    stages: ["Owner 승인", "법무 검토", "보안 검토", "공개"],
    activeRequests: 2,
    color: "bg-red-50 text-brand",
  },
  {
    id: "pipeline-review",
    icon: GitBranch,
    name: "Training Pipeline Review",
    description:
      "학습 파이프라인 변경 시 코드 리뷰 및 승인 정책. GPU 리소스 사용 승인이 포함됩니다.",
    stages: ["코드 리뷰", "리소스 검토", "Lead 승인"],
    activeRequests: 3,
    color: "bg-purple-50 text-accent-purple",
  },
];

export default function PolicyTemplatesPage() {
  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-text-primary">
            Policy Templates
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            거버넌스 정책 템플릿을 관리합니다. 각 정책은 승인 워크플로우를 정의합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <Input placeholder="템플릿 검색..." className="h-9 w-64 pl-8" />
          </div>
          <Button size="sm" className="bg-brand text-white hover:bg-brand/90">
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Policy
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((tpl) => (
          <article
            key={tpl.id}
            className="flex flex-col rounded-xl border border-dh-border bg-white p-5 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${tpl.color}`}
              >
                <tpl.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-semibold text-text-primary">
                  {tpl.name}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">{tpl.description}</p>
              </div>
            </div>

            <div className="mt-4 rounded-md bg-bg-surface p-3">
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                승인 단계
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {tpl.stages.map((s, idx) => (
                  <div key={s} className="flex items-center gap-1.5">
                    <span className="rounded-full border border-dh-border bg-white px-2 py-0.5 text-xs text-text-primary">
                      {s}
                    </span>
                    {idx < tpl.stages.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-text-muted" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-dh-border pt-4">
              <span className="text-xs text-text-secondary">
                활성 요청 <span className="font-semibold text-text-primary">{tpl.activeRequests}</span>건
              </span>
              <div className="flex items-center gap-2">
                <Link
                  href={`/governance?type=${tpl.id}`}
                  className="text-xs font-medium text-text-secondary hover:text-text-primary"
                >
                  요청 보기
                </Link>
                <Link
                  href={`/governance/templates/${tpl.id}`}
                  className="text-xs font-medium text-brand hover:text-brand/80"
                >
                  편집 →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
