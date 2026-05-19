"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export function ReportForm({ initialData, isEdit }: ReportFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const [form, setForm] = useState({
    planId: initialData?.planId ?? "",
    projectId: initialData?.projectId ?? "",
    dataName: initialData?.dataName ?? "",
    actualPeriodStart: initialData?.actualPeriodStart?.split("T")[0] ?? "",
    actualPeriodEnd: initialData?.actualPeriodEnd?.split("T")[0] ?? "",
    dataDescription: initialData?.dataDescription ?? "",
    dataSize: initialData?.dataSize ?? "",
    dataQuantity: initialData?.dataQuantity ?? "",
    qualityManagerId: initialData?.qualityManagerId ?? "",
    usageScope: initialData?.usageScope ?? "INTERNAL",
    storageLocation: initialData?.storageLocation ?? "",
    utilizationStatus: initialData?.utilizationStatus ?? "IN_USE",
    utilizationDate: initialData?.utilizationDate ?? "",
    needsMoreData: initialData?.needsMoreData ?? false,
    followUpPlan: initialData?.followUpPlan ?? "",
  });

  useEffect(() => {
    fetch("/api/plans?status=APPROVED&pageSize=100").then(r => r.json()).then(d => setPlans(d.data ?? [])).catch(() => {});
    fetch("/api/admin/users").then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.planId) {
      const plan = plans.find(p => p.id === form.planId);
      if (plan) {
        setForm(f => ({
          ...f,
          projectId: plan.projectId,
          dataName: plan.dataName,
        }));
      }
    }
  }, [form.planId, plans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEdit ? `/api/reports/${initialData.id}` : "/api/reports";
      const method = isEdit ? "PUT" : "POST";
      const body = {
        ...form,
        dataQuantity: form.dataQuantity ? Number(form.dataQuantity) : null,
        actualPeriodStart: form.actualPeriodStart ? new Date(form.actualPeriodStart).toISOString() : null,
        actualPeriodEnd: form.actualPeriodEnd ? new Date(form.actualPeriodEnd).toISOString() : null,
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        router.push("/reports");
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "저장에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const selCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const radioCls = "flex items-center gap-2 cursor-pointer";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>보고서 작성</CardTitle></CardHeader>
        <CardContent className="space-y-5">

          {/* 연결 기획서 (내부용) */}
          <div className="space-y-2">
            <Label>연결 기획서 *</Label>
            <select className={selCls} value={form.planId} onChange={e => setForm(f => ({ ...f, planId: e.target.value }))} required>
              <option value="">선택</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.dataName}</option>)}
            </select>
          </div>

          {/* 1. 프로젝트명(PMS) */}
          <div className="space-y-2">
            <Label>프로젝트명 (PMS)</Label>
            <Input value={plans.find(p => p.id === form.planId)?.project?.name ?? "-"} disabled className="bg-gray-50" />
          </div>

          {/* 2. 구축 기간 (실제) */}
          <div className="space-y-2">
            <Label>구축 기간 (실제)</Label>
            <div className="grid grid-cols-2 gap-4">
              <Input type="date" value={form.actualPeriodStart} onChange={e => setForm(f => ({ ...f, actualPeriodStart: e.target.value }))} />
              <Input type="date" value={form.actualPeriodEnd} onChange={e => setForm(f => ({ ...f, actualPeriodEnd: e.target.value }))} />
            </div>
          </div>

          {/* 3. 데이터 설명 (목적 포함) */}
          <div className="space-y-2">
            <Label>데이터 설명 (목적 포함)</Label>
            <Textarea value={form.dataDescription} onChange={e => setForm(f => ({ ...f, dataDescription: e.target.value }))} />
          </div>

          {/* 5. 데이터명 */}
          <div className="space-y-2">
            <Label>데이터명 *</Label>
            <Input value={form.dataName} onChange={e => setForm(f => ({ ...f, dataName: e.target.value }))} required />
          </div>

          {/* 6. 데이터 수량/크기 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>데이터 수량</Label>
              <Input type="number" placeholder="예: 10000" value={form.dataQuantity} onChange={e => setForm(f => ({ ...f, dataQuantity: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>데이터 크기</Label>
              <Input placeholder="예: 10GB" value={form.dataSize} onChange={e => setForm(f => ({ ...f, dataSize: e.target.value }))} />
            </div>
          </div>

          {/* 7. 생성 데이터 품질/검수 담당자 */}
          <div className="space-y-2">
            <Label>생성 데이터 품질 / 검수 담당자</Label>
            <select className={selCls} value={form.qualityManagerId} onChange={e => setForm(f => ({ ...f, qualityManagerId: e.target.value }))}>
              <option value="">선택</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>

          {/* 8. 최종 사용 가능 범위 */}
          <div className="space-y-2">
            <Label>최종 사용 가능 범위</Label>
            <div className="flex gap-6">
              {[
                { value: "CONFIDENTIAL", label: "공개 불가" },
                { value: "INTERNAL", label: "내부 실험 및 평가" },
                { value: "MODEL_SERVICE", label: "모델·서비스 학습" },
              ].map(opt => (
                <label key={opt.value} className={radioCls}>
                  <input type="radio" name="usageScope" value={opt.value} checked={form.usageScope === opt.value} onChange={e => setForm(f => ({ ...f, usageScope: e.target.value }))} />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 9. 데이터 적재 위치 */}
          <div className="space-y-2">
            <Label>데이터 적재 위치 (주소 상세까지)</Label>
            <Input placeholder="예: gs://bucket-name/path/to/data" value={form.storageLocation} onChange={e => setForm(f => ({ ...f, storageLocation: e.target.value }))} />
          </div>

          {/* 10. 활용 상태 */}
          <div className="space-y-2">
            <Label>활용 상태</Label>
            <div className="flex gap-6">
              {[
                { value: "IN_USE", label: "활용 중" },
                { value: "PLANNED", label: "활용 예정" },
                { value: "NOT_USED", label: "미활용" },
              ].map(opt => (
                <label key={opt.value} className={radioCls}>
                  <input type="radio" name="utilizationStatus" value={opt.value} checked={form.utilizationStatus === opt.value} onChange={e => setForm(f => ({ ...f, utilizationStatus: e.target.value }))} />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 11. 활용 예정 시점 */}
          {form.utilizationStatus === "PLANNED" && (
            <div className="space-y-2">
              <Label>활용 예정 시점</Label>
              <Input placeholder="예: 2026년 Q3" value={form.utilizationDate} onChange={e => setForm(f => ({ ...f, utilizationDate: e.target.value }))} />
            </div>
          )}

          {/* 12. 추가 데이터 생성 필요 여부 */}
          <div className="space-y-2">
            <Label>추가 데이터 생성 필요 여부</Label>
            <div className="flex gap-6">
              <label className={radioCls}>
                <input type="radio" name="needsMoreData" checked={form.needsMoreData === true} onChange={() => setForm(f => ({ ...f, needsMoreData: true }))} />
                <span className="text-sm">필요</span>
              </label>
              <label className={radioCls}>
                <input type="radio" name="needsMoreData" checked={form.needsMoreData === false} onChange={() => setForm(f => ({ ...f, needsMoreData: false }))} />
                <span className="text-sm">불필요</span>
              </label>
            </div>
          </div>

          {/* 13. 후속 관리 계획 */}
          <div className="space-y-2">
            <Label>후속 관리 계획 (보관 기간 등)</Label>
            <Textarea value={form.followUpPlan} onChange={e => setForm(f => ({ ...f, followUpPlan: e.target.value }))} />
          </div>

        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>취소</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "저장 중..." : isEdit ? "수정" : "작성"}
        </Button>
      </div>
    </form>
  );
}
