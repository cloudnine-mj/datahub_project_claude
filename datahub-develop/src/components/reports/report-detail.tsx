"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/utils";
import type { ReportWithRelations } from "@/types";

const statusLabels: Record<string, string> = { DRAFT: "작성 중", APPROVED: "제출 완료" };
const usageScopeLabels: Record<string, string> = { CONFIDENTIAL: "공개 불가", INTERNAL: "내부 실험 및 평가", MODEL_SERVICE: "모델·서비스 학습" };
const utilizationLabels: Record<string, string> = { IN_USE: "활용 중", PLANNED: "활용 예정", NOT_USED: "미활용" };

interface ReportDetailProps {
  report: ReportWithRelations;
}

export function ReportDetail({ report }: ReportDetailProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!confirm("보고서를 제출하시겠습니까?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${report.id}`, {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{report.dataName}</h1>
          <p className="text-muted-foreground mt-1">{report.project?.name}</p>
        </div>
        <div className="flex gap-2">
          {report.status === "DRAFT" && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "제출 중..." : "제출"}
            </Button>
          )}
        </div>
      </div>

      <Badge>{statusLabels[report.status]}</Badge>

      <Card>
        <CardHeader><CardTitle>보고서</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <InfoRow label="프로젝트명 (PMS)" value={report.project?.name} />
          <Separator />
          <InfoRow label="구축 기간 (실제)" value={`${report.actualPeriodStart ? formatDate(report.actualPeriodStart) : "-"} ~ ${report.actualPeriodEnd ? formatDate(report.actualPeriodEnd) : "-"}`} />
          <Separator />
          <InfoRow label="데이터 책임자" value={report.author?.name} />
          <Separator />
          <LongRow label="데이터 설명 (목적 포함)" value={report.dataDescription} />
          <Separator />
          <InfoRow label="데이터명" value={report.dataName} />
          <Separator />
          <InfoRow label="데이터 수량 / 크기" value={[report.dataQuantity ? `${report.dataQuantity}건` : null, report.dataSize].filter(Boolean).join(" / ") || "-"} />
          <Separator />
          <InfoRow label="품질 / 검수 담당자" value={report.qualityManager?.name} />
          <Separator />
          <InfoRow label="최종 사용 가능 범위" value={usageScopeLabels[report.usageScope]} />
          <Separator />
          <InfoRow label="데이터 적재 위치" value={report.storageLocation} />
          <Separator />
          <InfoRow label="활용 상태" value={utilizationLabels[(report as any).utilizationStatus] ?? "-"} />
          <Separator />
          <InfoRow label="추가 데이터 생성 필요 여부" value={report.needsMoreData ? "필요" : "불필요"} />
          <Separator />
          <LongRow label="후속 관리 계획" value={report.followUpPlan} />
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "-"}</span>
    </div>
  );
}

function LongRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <p className="text-sm whitespace-pre-wrap">{value || "-"}</p>
    </div>
  );
}
