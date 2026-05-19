"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PlanForm } from "@/components/plans/plan-form";

export default function PlanEditPage() {
  const params = useParams();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/plans/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setPlan(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">불러오는 중...</p></div>;
  if (!plan) return <div className="flex items-center justify-center h-64"><p className="text-gray-500">기획서를 찾을 수 없습니다.</p></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">기획서 수정</h1>
        <p className="text-gray-500">기획서 정보를 수정합니다.</p>
      </div>
      <PlanForm initialData={plan} isEdit />
    </div>
  );
}
