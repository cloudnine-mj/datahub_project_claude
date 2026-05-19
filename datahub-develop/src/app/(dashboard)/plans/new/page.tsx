"use client";

import { PlanForm } from "@/components/plans/plan-form";

export default function NewPlanPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">새 레포지토리 생성</h1>
        <p className="text-gray-500">데이터 레포지토리를 생성합니다.</p>
      </div>
      <PlanForm />
    </div>
  );
}
