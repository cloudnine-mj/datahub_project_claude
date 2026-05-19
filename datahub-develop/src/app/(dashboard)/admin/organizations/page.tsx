"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit, ChevronDown, ChevronRight, Users } from "lucide-react";

export default function AdminOrganizationsPage() {
  const [labs, setLabs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Dialog state
  const [dlg, setDlg] = useState(false);
  const [dlgType, setDlgType] = useState<"lab" | "techCell">("lab");
  const [editId, setEditId] = useState<string | null>(null);
  const [parentLabId, setParentLabId] = useState<string>("");
  const [form, setForm] = useState({ name: "", leaderId: "" });
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/organizations").then(r => r.ok ? r.json() : []).then(setLabs).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetch("/api/admin/users").then(r => r.ok ? r.json() : { data: [] }).then(d => setUsers(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
  }, []);

  const openNewLab = () => {
    setDlgType("lab"); setEditId(null); setParentLabId("");
    setForm({ name: "", leaderId: "" }); setDlg(true);
  };
  const openEditLab = (lab: any) => {
    setDlgType("lab"); setEditId(lab.id); setParentLabId("");
    setForm({ name: lab.name, leaderId: lab.leaderId || "" }); setDlg(true);
  };
  const openNewTC = (labId: string) => {
    setDlgType("techCell"); setEditId(null); setParentLabId(labId);
    setForm({ name: "", leaderId: "" }); setDlg(true);
  };
  const openEditTC = (tc: any) => {
    setDlgType("techCell"); setEditId(tc.id); setParentLabId(tc.labId);
    setForm({ name: tc.name, leaderId: tc.leaderId || "" }); setDlg(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body: any = { type: dlgType, name: form.name, leaderId: form.leaderId || null };
      if (dlgType === "techCell") body.labId = parentLabId;
      const url = editId ? `/api/organizations/${editId}` : "/api/organizations";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setDlg(false); load(); } else alert("저장에 실패했습니다.");
    } catch { alert("오류가 발생했습니다."); } finally { setSaving(false); }
  };

  const del = async (id: string, type: string) => {
    const label = type === "lab" ? "랩" : "테크셀";
    if (!confirm(`이 ${label}을(를) 삭제하시겠습니까? 하위 데이터도 함께 삭제됩니다.`)) return;
    await fetch(`/api/organizations/${id}?type=${type}`, { method: "DELETE" });
    load();
  };

  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">조직 관리</h1>
          <p className="text-gray-500">랩과 테크셀을 관리합니다. (ADMIN 전용)</p>
        </div>
        <Button onClick={openNewLab}><Plus className="mr-2 h-4 w-4" />새 랩</Button>
      </div>

      {loading ? <p className="py-8 text-center text-gray-500">불러오는 중...</p> : labs.length === 0 ? <p className="py-8 text-center text-gray-500">등록된 랩이 없습니다.</p> : labs.map(lab => (
        <Card key={lab.id}>
          <CardHeader className="cursor-pointer" onClick={() => toggle(lab.id)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {open[lab.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {lab.name}
                <Badge variant="secondary" className="text-xs font-normal">
                  <Users className="mr-1 h-3 w-3" />{lab._count?.members ?? 0}명
                </Badge>
                <span className="text-sm text-gray-400 font-normal">({lab.techCells?.length ?? 0} 테크셀)</span>
              </CardTitle>
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-gray-400 mr-2">리더: {lab.leader?.name ?? "미지정"}</span>
                <Button variant="ghost" size="sm" onClick={() => openEditLab(lab)}><Edit className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" className="text-red-500" onClick={() => del(lab.id, "lab")}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          {open[lab.id] && (
            <CardContent className="space-y-3">
              {lab.techCells?.map((tc: any) => (
                <div key={tc.id} className="flex items-center justify-between rounded border p-3">
                  <div>
                    <span className="text-sm font-medium">{tc.name}</span>
                    <span className="text-xs text-gray-400 ml-2">리더: {tc.leader?.name ?? "미지정"}</span>
                    <Badge variant="secondary" className="text-xs ml-2"><Users className="mr-1 h-3 w-3" />{tc._count?.members ?? 0}명</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditTC(tc)}><Edit className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => del(tc.id, "techCell")}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="mt-2" onClick={() => openNewTC(lab.id)}>
                <Plus className="mr-1 h-3 w-3" />테크셀 추가
              </Button>
            </CardContent>
          )}
        </Card>
      ))}

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? (dlgType === "lab" ? "랩 수정" : "테크셀 수정") : (dlgType === "lab" ? "새 랩" : "새 테크셀")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={dlgType === "lab" ? "랩 이름" : "테크셀 이름"} />
            </div>
            <div className="space-y-2">
              <Label>리더</Label>
              <Select value={form.leaderId} onValueChange={v => setForm(f => ({ ...f, leaderId: v }))}>
                <SelectTrigger><SelectValue placeholder="리더 선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  {users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlg(false)}>취소</Button>
            <Button onClick={save} disabled={saving}>{saving ? "저장 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
