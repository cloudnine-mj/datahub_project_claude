"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ReportForm } from "@/components/reports/report-form";

export default function ReportEditPage() {
  const params = useParams();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reports/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setReport(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">불러오는 중...</p></div>;
  if (!report) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">보고서를 찾을 수 없습니다.</p></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">보고서 수정</h1>
        <p className="text-gray-500">보고서 정보를 수정합니다.</p>
      </div>
      <ReportForm initialData={report} isEdit />
    </div>
  );
}
