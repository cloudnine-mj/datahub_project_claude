"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlanFormProps {
  initialData?: any;
  isEdit?: boolean;
}

export function PlanForm({ initialData, isEdit }: PlanFormProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // period 파싱: "2026.03 ~ 2026.06" → startMonth="2026-03", endMonth="2026-06"
  const parsePeriod = (p?: string) => {
    if (!p) return { start: "", end: "" };
    const m = p.match(/(\d{4})[.\-/](\d{2})\s*~\s*(\d{4})[.\-/](\d{2})/);
    if (m) return { start: `${m[1]}-${m[2]}`, end: `${m[3]}-${m[4]}` };
    return { start: "", end: "" };
  };
  const parsed = parsePeriod(initialData?.period);
  const [periodStart, setPeriodStart] = useState(parsed.start);
  const [periodEnd, setPeriodEnd] = useState(parsed.end);

  const [form, setForm] = useState({
    projectId: initialData?.projectId ?? "",
    period: initialData?.period ?? "",
    purposeType: initialData?.purposeType ?? "DATA_CONSTRUCTION",
    purpose: initialData?.purpose ?? "",
    complianceChecked: initialData?.complianceChecked ?? false,
    dataName: initialData?.dataName ?? "",
    estimatedCost: initialData?.estimatedCost ?? 0,
    modality: initialData?.modality ?? "Text",
    dataDescription: initialData?.dataDescription ?? "",
    qualityManagerId: initialData?.qualityManagerId ?? "",
    usageScope: initialData?.usageScope ?? "INTERNAL",
  });

  useEffect(() => {
    fetch("/api/projects").then(r => r.json()).then(d => setAllProjects(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
    fetch("/api/admin/users").then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEdit ? `/api/plans/${initialData.id}` : "/api/plans";
      const method = isEdit ? "PUT" : "POST";
      const periodStr =
        periodStart && periodEnd
          ? `${periodStart.replace("-", ".")} ~ ${periodEnd.replace("-", ".")}`
          : "";
      const body = {
        ...form,
        period: periodStr,
        estimatedCost: Number(form.estimatedCost),
      };
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        router.push("/plans");
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
        <CardHeader><CardTitle>기획서 작성</CardTitle></CardHeader>
        <CardContent className="space-y-5">

          {/* 1. 프로젝트명 */}
          <div className="space-y-2">
            <Label>프로젝트명 (PMS 등록 예정 과제명) *</Label>
            <select className={selCls} value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))} required>
              <option value="">프로젝트 선택</option>
              {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* 2. 수행 기간 */}
          <div className="space-y-2">
            <Label>수행 기간</Label>
            <div className="flex items-center gap-2">
              <Input
                type="month"
                value={periodStart}
                onChange={e => setPeriodStart(e.target.value)}
                className="w-44"
              />
              <span className="text-sm text-gray-500">~</span>
              <Input
                type="month"
                value={periodEnd}
                min={periodStart}
                onChange={e => setPeriodEnd(e.target.value)}
                className="w-44"
              />
            </div>
          </div>

          {/* 3. 목적 구분 */}
          <div className="space-y-2">
            <Label>목적 구분</Label>
            <div className="flex gap-6">
              <label className={radioCls}>
                <input type="radio" name="purposeType" value="DATA_CONSTRUCTION" checked={form.purposeType === "DATA_CONSTRUCTION"} onChange={e => setForm(f => ({ ...f, purposeType: e.target.value }))} />
                <span className="text-sm">데이터 구축</span>
              </label>
              <label className={radioCls}>
                <input type="radio" name="purposeType" value="OTHER" checked={form.purposeType === "OTHER"} onChange={e => setForm(f => ({ ...f, purposeType: e.target.value }))} />
                <span className="text-sm">그 외</span>
              </label>
            </div>
          </div>

          {/* 5. 사용 목적 / 기대 효과 */}
          <div className="space-y-2">
            <Label>사용 목적 / 기대 효과</Label>
            <Textarea
              placeholder="모델 및 서비스명 포함"
              value={form.purpose}
              onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
            />
          </div>

          {/* 6. compliance 확인 여부 */}
          <div className="space-y-2">
            <Label>활용 모델에 대한 compliance 확인 여부</Label>
            <div className="flex gap-6">
              <label className={radioCls}>
                <input type="radio" name="compliance" checked={form.complianceChecked === true} onChange={() => setForm(f => ({ ...f, complianceChecked: true }))} />
                <span className="text-sm">확인 완료</span>
              </label>
              <label className={radioCls}>
                <input type="radio" name="compliance" checked={form.complianceChecked === false} onChange={() => setForm(f => ({ ...f, complianceChecked: false }))} />
                <span className="text-sm">확인 필요</span>
              </label>
            </div>
          </div>

          {/* 7. 데이터명 (가칭) */}
          <div className="space-y-2">
            <Label>데이터명 (가칭) *</Label>
            <Input value={form.dataName} onChange={e => setForm(f => ({ ...f, dataName: e.target.value }))} required />
          </div>

          {/* 8. 예상 비용 */}
          <div className="space-y-2">
            <Label>예상 비용 (원)</Label>
            <Input type="number" value={form.estimatedCost} onChange={e => setForm(f => ({ ...f, estimatedCost: e.target.value }))} />
          </div>

          {/* 9. 데이터 타입 */}
          <div className="space-y-2">
            <Label>데이터 타입</Label>
            <div className="flex gap-6">
              {[
                { value: "Text", label: "text" },
                { value: "Image", label: "image" },
                { value: "Multimodal", label: "multimodal" },
                { value: "Other", label: "기타" },
              ].map(opt => (
                <label key={opt.value} className={radioCls}>
                  <input type="radio" name="modality" value={opt.value} checked={form.modality === opt.value} onChange={e => setForm(f => ({ ...f, modality: e.target.value }))} />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 10. 데이터 설명 */}
          <div className="space-y-2">
            <Label>데이터 설명</Label>
            <Textarea value={form.dataDescription} onChange={e => setForm(f => ({ ...f, dataDescription: e.target.value }))} />
          </div>

          {/* 11. 생성 데이터 품질/검수 담당자 */}
          <div className="space-y-2">
            <Label>생성 데이터 품질 / 검수 담당자</Label>
            <select className={selCls} value={form.qualityManagerId} onChange={e => setForm(f => ({ ...f, qualityManagerId: e.target.value }))}>
              <option value="">선택</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>

          {/* 12. 데이터셋 사용 가능 범위 */}
          <div className="space-y-2">
            <Label>데이터셋 사용 가능 범위</Label>
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
