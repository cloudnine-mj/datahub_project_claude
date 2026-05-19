"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { PlanWithRelations } from "@/types";

const statusLabels: Record<string, string> = {
  DRAFT: "작성 중",
  APPROVED: "제출 완료",
  IN_PROGRESS: "진행 중",
  COMPLETED: "완료",
};

const usageScopeLabels: Record<string, string> = {
  CONFIDENTIAL: "공개 불가",
  INTERNAL: "내부 실험 및 평가",
  MODEL_SERVICE: "모델·서비스 학습",
};

const modalityLabels: Record<string, string> = {
  Text: "text",
  Image: "image",
  Multimodal: "multimodal",
  Other: "기타",
};

interface PlanDetailProps {
  plan: PlanWithRelations;
}

export function PlanDetail({ plan }: PlanDetailProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!confirm("기획서를 제출하시겠습니까?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (res.ok) {
        router.refresh();
        window.location.reload();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/plans/${plan.id}`, { method: "DELETE" });
    if (res.ok) router.push("/plans");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{plan.dataName}</h1>
          <p className="text-muted-foreground mt-1">{plan.project?.name}</p>
        </div>
        <div className="flex gap-2">
          {plan.status === "DRAFT" && (
            <>
              <Button variant="outline" onClick={() => router.push(`/plans/${plan.id}/edit`)}>수정</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "제출 중..." : "제출"}
              </Button>
              <Button variant="destructive" onClick={handleDelete}>삭제</Button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Badge>{statusLabels[plan.status]}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>기획서</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="프로젝트명 (PMS 등록 예정 과제명)" value={plan.project?.name} />
          <InfoRow label="수행 기간" value={(plan as any).period} />
          <InfoRow label="데이터 책임자 / API 활용 책임자" value={plan.author?.name} />
          <InfoRow label="목적 구분" value={plan.purposeType === "DATA_CONSTRUCTION" ? "데이터 구축" : "그 외"} />
          <InfoRow label="사용 목적 / 기대 효과" value={plan.purpose} long />
          <InfoRow label="compliance 확인 여부" value={plan.complianceChecked ? "확인 완료" : "확인 필요"} />
          <InfoRow label="데이터명 (가칭)" value={plan.dataName} />
          <InfoRow label="예상 비용" value={formatCurrency(plan.estimatedCost)} />
          <InfoRow label="데이터 타입" value={modalityLabels[plan.modality] ?? plan.modality} />
          <InfoRow label="데이터 설명" value={plan.dataDescription} long />
          <InfoRow label="품질 / 검수 담당자" value={plan.qualityManager?.name} />
          <InfoRow label="데이터셋 사용 가능 범위" value={usageScopeLabels[plan.usageScope]} />
        </CardContent>
      </Card>

      {plan.reports && plan.reports.length > 0 && (
        <Card>
          <CardHeader><CardTitle>연결된 보고서</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.reports.map((r: any) => (
                <li key={r.id}>
                  <a href={`/reports/${r.id}`} className="text-blue-600 hover:underline">{r.dataName}</a>
                  <span className="ml-2 text-sm text-muted-foreground">{formatDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({ label, value, long }: { label: string; value?: string | null; long?: boolean }) {
  if (long && value) {
    return (
      <div className="space-y-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <p className="text-sm whitespace-pre-wrap">{value}</p>
      </div>
    );
  }
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "-"}</span>
    </div>
  );
}
