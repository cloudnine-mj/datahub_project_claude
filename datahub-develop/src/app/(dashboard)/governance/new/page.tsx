"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const requestTypes = [
  { value: "model_release", label: "Model Release" },
  { value: "data_access", label: "Data Access" },
  { value: "dataset_publish", label: "Dataset Publishing" },
  { value: "pipeline_review", label: "Pipeline Review" },
];

const priorities = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const repos = [
  "lgair/exaone-3.5-instruct",
  "lg-research/bert-ko-v3",
  "lg-air-science/indoor-air-quality-2024",
  "lg-data/korean-ner-corpus",
  "lg-research/speech-recognition-v2",
];

const candidateApprovers = [
  { id: "ss", name: "Sanghyun Seo", initials: "SS" },
  { id: "jk", name: "Jieun Kim", initials: "JK" },
  { id: "mp", name: "Minjun Park", initials: "MP" },
  { id: "sc", name: "Soyeon Choi", initials: "SC" },
];

export default function GovernanceNewPage() {
  const router = useRouter();
  const [approvers, setApprovers] = useState<string[]>(["ss"]);

  const toggleApprover = (id: string) => {
    setApprovers((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/governance");
  };

  return (
    <div>
      <Link
        href="/governance"
        className="mb-4 inline-flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Governance Requests
      </Link>

      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-text-primary">
          New Governance Request
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          새로운 거버넌스 요청을 생성합니다. 요청 유형에 따라 승인 워크플로우가 자동으로 적용됩니다.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-dh-border bg-white p-6">
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="type">Request Type</Label>
              <Select defaultValue="model_release">
                <SelectTrigger id="type">
                  <SelectValue placeholder="요청 유형을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {requestTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="예: exaone-3.5-instruct 1.2.0 프로덕션 릴리즈" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                rows={6}
                placeholder="요청 배경, 변경 사항, 영향 범위, 검토 포인트를 작성하세요."
              />
              <p className="text-xs text-text-muted">
                Markdown 지원. 첨부 파일은 URL로 링크하세요.
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Related Repository</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="레포지토리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {repos.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select defaultValue="medium">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Approvers</Label>
              <div className="flex flex-wrap gap-2">
                {candidateApprovers.map((a) => {
                  const selected = approvers.includes(a.id);
                  return (
                    <button
                      type="button"
                      key={a.id}
                      onClick={() => toggleApprover(a.id)}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-dh-border bg-white text-text-secondary hover:border-brand/30"
                      }`}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-bg-surface text-[10px] font-semibold text-text-primary">
                        {a.initials}
                      </span>
                      {a.name}
                      {selected && <X className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-2 border-t border-dh-border pt-4">
            <Button asChild variant="outline" type="button">
              <Link href="/governance">Cancel</Link>
            </Button>
            <Button variant="outline" type="button">
              Save Draft
            </Button>
            <Button type="submit" className="bg-brand text-white hover:bg-brand/90">
              Submit Request
            </Button>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-xl border border-dh-border bg-white p-4 text-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase text-text-secondary">
              자동 적용 정책
            </h3>
            <p className="text-text-primary">Model Release Approval</p>
            <p className="mt-1 text-xs text-text-secondary">
              요청 유형에 따라 자동 매칭된 정책 템플릿입니다.{" "}
              <Link href="/governance/templates" className="text-brand hover:underline">
                템플릿 보기
              </Link>
            </p>
          </section>

          <section className="rounded-xl border border-dh-border bg-bg-surface p-4 text-xs text-text-secondary">
            <h3 className="mb-2 font-semibold text-text-primary">Tips</h3>
            <ul className="list-disc space-y-1 pl-4">
              <li>모델 릴리즈는 최소 2명 승인이 기본입니다.</li>
              <li>민감 데이터셋은 분류 등급에 따라 추가 승인이 필요합니다.</li>
              <li>긴급 요청은 Critical 우선순위로 24시간 내 처리됩니다.</li>
            </ul>
          </section>
        </aside>
      </form>
    </div>
  );
}
