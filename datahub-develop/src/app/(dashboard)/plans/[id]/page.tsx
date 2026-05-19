"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeft, Edit, CheckCircle, Trash2, Download } from "lucide-react";

const statusLabel: Record<string, string> = {
  DRAFT: "작성 중", APPROVED: "제출 완료",
  IN_PROGRESS: "진행 중", COMPLETED: "완료",
};
const statusColor: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  APPROVED: "bg-green-100 text-green-700",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700", COMPLETED: "bg-purple-100 text-purple-700",
};
const modalityLabel: Record<string, string> = { Text: "text", Image: "image", Multimodal: "multimodal", Other: "기타" };
const usageScopeLabel: Record<string, string> = { CONFIDENTIAL: "공개 불가", INTERNAL: "내부 실험 및 평가", MODEL_SERVICE: "모델·서비스 학습" };

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/plans/${params.id}`);
        if (res.ok) {
          setPlan(await res.json());
        }
      } catch (error) {
        console.error("Failed to fetch plan:", error);
      } finally {
        setLoading(false);
      }
    }
    if (params.id) fetchPlan();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm("정말로 이 레포지토리 명세를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/plans/${params.id}`, { method: "DELETE" });
      if (res.ok) router.push("/plans");
      else alert("삭제에 실패했습니다.");
    } catch { alert("삭제 중 오류가 발생했습니다."); }
  };

  const handleSubmit = async () => {
    if (!confirm("레포지토리 명세를 제출하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/plans/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (res.ok) {
        alert("제출이 완료되었습니다.");
        const updated = await fetch(`/api/plans/${params.id}`);
        if (updated.ok) setPlan(await updated.json());
      } else {
        const err = await res.json();
        alert(err.error || "제출에 실패했습니다.");
      }
    } catch { alert("제출 중 오류가 발생했습니다."); }
  };

  const handleExportExcel = () => {
    if (!plan) return;

    const rows: [string, string][] = [
      ["프로젝트명 (PMS 등록 예정 과제명)", plan.project?.name ?? "-"],
      ["수행 기간", plan.period ?? "-"],
      ["데이터 책임자 / API 활용 책임자", plan.author?.name ?? "-"],
      ["목적 구분", plan.purposeType === "DATA_CONSTRUCTION" ? "데이터 구축" : "그 외"],
      ["사용 목적 / 기대 효과", plan.purpose ?? "-"],
      ["compliance 확인 여부", plan.complianceChecked ? "확인 완료" : "확인 필요"],
      ["데이터명 (가칭)", plan.dataName ?? "-"],
      ["예상 비용", formatCurrency(plan.estimatedCost)],
      ["데이터 타입", modalityLabel[plan.modality] ?? plan.modality ?? "-"],
      ["데이터 설명", plan.dataDescription ?? "-"],
      ["생성 데이터 품질 / 검수 담당자", plan.qualityManager?.name ?? "-"],
      ["데이터셋 사용 가능 범위", usageScopeLabel[plan.usageScope] ?? plan.usageScope ?? "-"],
      ["상태", statusLabel[plan.status] ?? plan.status],
      ["작성일", formatDate(plan.createdAt)],
    ];

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const tableRows = rows
      .map(
        ([label, value]) =>
          `<tr><td style="background:#f3f4f6;font-weight:bold;padding:6px 12px;border:1px solid #d1d5db;white-space:nowrap;">${esc(label)}</td><td style="padding:6px 12px;border:1px solid #d1d5db;white-space:pre-wrap;">${esc(value)}</td></tr>`,
      )
      .join("");

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8" /><style>td{font-family:sans-serif;font-size:11pt;vertical-align:top;}</style></head>
      <body><table>${tableRows}</table></body></html>`;

    const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plan.dataName || "레포지토리_명세"}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">불러오는 중...</p></div>;
  if (!plan) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">레포지토리 명세를 찾을 수 없습니다.</p></div>;

  const isDraft = plan.status === "DRAFT";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{plan.dataName}</h1>
            <p className="text-gray-500">{plan.project?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={statusColor[plan.status] ?? ""}>
            {statusLabel[plan.status] ?? plan.status}
          </Badge>
          {isDraft && (
            <>
              <Link href={`/plans/${plan.id}/edit`}>
                <Button variant="outline" size="sm"><Edit className="mr-1 h-3 w-3" />수정</Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleSubmit}>
                <CheckCircle className="mr-1 h-3 w-3" />제출
              </Button>
              <Button variant="outline" size="sm" className="text-red-600" onClick={handleDelete}>
                <Trash2 className="mr-1 h-3 w-3" />삭제
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>레포지토리 명세</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="mr-1 h-3 w-3" />엑셀 내보내기
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="프로젝트명 (PMS 등록 예정 과제명)" value={plan.project?.name} />
          <Separator />
          <Row label="수행 기간" value={plan.period} />
          <Separator />
          <Row label="데이터 책임자 / API 활용 책임자" value={plan.author?.name} />
          <Separator />
          <Row label="목적 구분" value={plan.purposeType === "DATA_CONSTRUCTION" ? "데이터 구축" : "그 외"} />
          <Separator />
          <LongRow label="사용 목적 / 기대 효과" value={plan.purpose} />
          <Separator />
          <Row label="compliance 확인 여부" value={plan.complianceChecked ? "확인 완료" : "확인 필요"} />
          <Separator />
          <Row label="데이터명 (가칭)" value={plan.dataName} />
          <Separator />
          <Row label="예상 비용" value={formatCurrency(plan.estimatedCost)} />
          <Separator />
          <Row label="데이터 타입" value={modalityLabel[plan.modality] ?? plan.modality} />
          <Separator />
          <LongRow label="데이터 설명" value={plan.dataDescription} />
          <Separator />
          <Row label="생성 데이터 품질 / 검수 담당자" value={plan.qualityManager?.name} />
          <Separator />
          <Row label="데이터셋 사용 가능 범위" value={usageScopeLabel[plan.usageScope] ?? plan.usageScope} />
        </CardContent>
      </Card>

      {plan.reports && plan.reports.length > 0 && (
        <Card>
          <CardHeader><CardTitle>연결된 보고서</CardTitle></CardHeader>
          <CardContent>
            {plan.reports.map((report: any) => (
              <Link key={report.id} href={`/reports/${report.id}`} className="block">
                <div className="flex items-center justify-between rounded-lg border p-3 mb-2 hover:bg-gray-50">
                  <span className="text-sm font-medium">{report.dataName}</span>
                  <Badge variant="outline">{report.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
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
