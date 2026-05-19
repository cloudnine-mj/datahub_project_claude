"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Edit, CheckCircle, Trash2 } from "lucide-react";

const statusLabel: Record<string, string> = { DRAFT: "작성 중", APPROVED: "제출 완료" };
const statusColor: Record<string, string> = { DRAFT: "bg-gray-100 text-gray-700", APPROVED: "bg-green-100 text-green-700" };
const usageScopeLabel: Record<string, string> = { CONFIDENTIAL: "공개 불가", INTERNAL: "내부 실험 및 평가", MODEL_SERVICE: "모델·서비스 학습" };
const utilizationLabel: Record<string, string> = { IN_USE: "활용 중", PLANNED: "활용 예정", NOT_USED: "미활용" };

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/${params.id}`).then(r => r.ok ? r.json() : null).then(d => setReport(d)).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("정말로 이 보고서를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/reports/${params.id}`, { method: "DELETE" });
    if (res.ok) router.push("/reports");
    else alert("삭제에 실패했습니다.");
  };

  const handleSubmit = async () => {
    if (!confirm("보고서를 제출하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/reports/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (res.ok) { alert("제출이 완료되었습니다."); const u = await fetch(`/api/reports/${params.id}`); if (u.ok) setReport(await u.json()); }
      else { const err = await res.json(); alert(err.error || "제출에 실패했습니다."); }
    } catch { alert("오류가 발생했습니다."); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">불러오는 중...</p></div>;
  if (!report) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">보고서를 찾을 수 없습니다.</p></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">{report.dataName}</h1>
            <p className="text-gray-500">{report.project?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusColor[report.status]}>{statusLabel[report.status] ?? report.status}</Badge>
          {report.status === "DRAFT" && <>
            <Link href={`/reports/${report.id}/edit`}><Button variant="outline" size="sm"><Edit className="mr-1 h-3 w-3" />수정</Button></Link>
            <Button size="sm" onClick={handleSubmit}><CheckCircle className="mr-1 h-3 w-3" />제출</Button>
            <Button variant="outline" size="sm" className="text-red-600" onClick={handleDelete}><Trash2 className="mr-1 h-3 w-3" />삭제</Button>
          </>}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>보고서</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Row label="프로젝트명 (PMS)" value={report.project?.name} />
          <Separator />
          <Row label="구축 기간 (실제)" value={`${report.actualPeriodStart ? formatDate(report.actualPeriodStart) : "-"} ~ ${report.actualPeriodEnd ? formatDate(report.actualPeriodEnd) : "-"}`} />
          <Separator />
          <Row label="데이터 책임자" value={report.author?.name} />
          <Separator />
          <LongRow label="데이터 설명 (목적 포함)" value={report.dataDescription} />
          <Separator />
          <Row label="데이터명" value={report.dataName} />
          <Separator />
          <Row label="데이터 수량 / 크기" value={[report.dataQuantity ? `${report.dataQuantity}건` : null, report.dataSize].filter(Boolean).join(" / ") || "-"} />
          <Separator />
          <Row label="품질 / 검수 담당자" value={report.qualityManager?.name} />
          <Separator />
          <Row label="최종 사용 가능 범위" value={usageScopeLabel[report.usageScope] ?? report.usageScope} />
          <Separator />
          <Row label="데이터 적재 위치" value={report.storageLocation} />
          <Separator />
          <Row label="활용 상태" value={utilizationLabel[report.utilizationStatus] ?? report.utilizationStatus ?? "-"} />
          <Separator />
          {report.utilizationStatus === "PLANNED" && <>
            <Row label="활용 예정 시점" value={report.utilizationDate} />
            <Separator />
          </>}
          <Row label="추가 데이터 생성 필요 여부" value={report.needsMoreData ? "필요" : "불필요"} />
          <Separator />
          <LongRow label="후속 관리 계획" value={report.followUpPlan} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium">{value ?? "-"}</span>
    </div>
  );
}

function LongRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <span className="text-sm text-gray-500">{label}</span>
      <p className="text-sm whitespace-pre-wrap">{value || "-"}</p>
    </div>
  );
}
