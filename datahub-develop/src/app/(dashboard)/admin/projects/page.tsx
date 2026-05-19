"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";

const stL: any = { ACTIVE: "활성", COMPLETED: "완료", ON_HOLD: "보류", CANCELLED: "취소" };
const stC: any = { ACTIVE: "bg-green-100 text-green-700", COMPLETED: "bg-blue-100 text-blue-700", ON_HOLD: "bg-yellow-100 text-yellow-700", CANCELLED: "bg-red-100 text-red-700" };

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("ko-KR") : "-";

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [labs, setLabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dlg, setDlg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [form, setForm] = useState({
    name: "", pmsCode: "", pmLeaderId: "", tmLeaderId: "", labId: "",
    budget: 0, quarter: "", status: "ACTIVE", startDate: "", endDate: "",
  });

  const load = () => {
    fetch("/api/projects").then(r => r.ok ? r.json() : []).then(d => setProjects(Array.isArray(d) ? d : d.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    fetch("/api/admin/users").then(r => r.ok ? r.json() : []).then(d => setUsers(Array.isArray(d) ? d : d.data ?? [])).catch(() => {});
    fetch("/api/organizations").then(r => r.ok ? r.json() : []).then(setLabs).catch(() => {});
  }, []);

  const h = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }));

  const years = Array.from(new Set(projects.map(p => p.year).filter(Boolean))).sort((a, b) => b - a);

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (yearFilter !== "ALL" && String(p.year) !== yearFilter) return false;
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    return true;
  });

  const openNew = () => {
    setEditId(null);
    setForm({ name: "", pmsCode: "", pmLeaderId: "", tmLeaderId: "", labId: "", budget: 0, quarter: "", status: "ACTIVE", startDate: "", endDate: "" });
    setDlg(true);
  };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setForm({
      name: p.name, pmsCode: p.pmsCode || "", pmLeaderId: p.pmLeaderId || "", tmLeaderId: p.tmLeaderId || "",
      labId: p.labId || "", budget: p.budget, quarter: p.quarter || "", status: p.status,
      startDate: p.startDate?.split("T")[0] || "", endDate: p.endDate?.split("T")[0] || "",
    });
    setDlg(true);
  };
  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form, budget: Number(form.budget),
        pmLeaderId: form.pmLeaderId || null, tmLeaderId: form.tmLeaderId || null,
        labId: form.labId || null, pmsCode: form.pmsCode || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
        year: form.startDate ? new Date(form.startDate).getFullYear() : null,
      };
      const url = editId ? `/api/projects/${editId}` : "/api/projects";
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setDlg(false); load(); } else alert("저장 실패");
    } catch { alert("오류"); } finally { setSaving(false); }
  };
  const del = async (id: string) => {
    if (!confirm("이 프로젝트를 삭제하시겠습니까?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">프로젝트 관리</h1>
          <p className="text-gray-500">프로젝트를 관리합니다. ({projects.length}개)</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />새 프로젝트</Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input placeholder="프로젝트 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="연도" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 연도</SelectItem>
                {years.map(y => <SelectItem key={y} value={String(y)}>{y}년</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="상태" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체</SelectItem>
                <SelectItem value="ACTIVE">활성</SelectItem>
                <SelectItem value="COMPLETED">완료</SelectItem>
                <SelectItem value="ON_HOLD">보류</SelectItem>
                <SelectItem value="CANCELLED">취소</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-center py-8 text-gray-500">불러오는 중...</p> : filtered.length === 0 ? <p className="text-center py-8 text-gray-500">프로젝트가 없습니다.</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>수행조직</TableHead>
                  <TableHead>수행기간</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium max-w-md truncate">{p.name}</TableCell>
                    <TableCell className="text-sm">{p.lab?.name ?? "-"}</TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{fmtDate(p.startDate)} ~ {fmtDate(p.endDate)}</TableCell>
                    <TableCell><Badge variant="outline" className={stC[p.status]}>{stL[p.status] || p.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>수정</Button>
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => del(p.id)}>삭제</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dlg} onOpenChange={setDlg}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? "프로젝트 수정" : "새 프로젝트"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>이름 *</Label><Input value={form.name} onChange={e => h("name", e.target.value)} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>수행조직</Label>
                <Select value={form.labId} onValueChange={v => h("labId", v)}>
                  <SelectTrigger><SelectValue placeholder="조직 선택" /></SelectTrigger>
                  <SelectContent>{labs.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>PMS 코드</Label><Input value={form.pmsCode} onChange={e => h("pmsCode", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>시작일</Label><Input type="date" value={form.startDate} onChange={e => h("startDate", e.target.value)} /></div>
              <div className="space-y-2"><Label>종료일</Label><Input type="date" value={form.endDate} onChange={e => h("endDate", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PM Leader</Label>
                <Select value={form.pmLeaderId} onValueChange={v => h("pmLeaderId", v)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>TM Leader</Label>
                <Select value={form.tmLeaderId} onValueChange={v => h("tmLeaderId", v)}>
                  <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                  <SelectContent>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>예산 (원)</Label><Input type="number" value={form.budget} onChange={e => h("budget", e.target.value)} /></div>
              <div className="space-y-2">
                <Label>상태</Label>
                <Select value={form.status} onValueChange={v => h("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">활성</SelectItem><SelectItem value="COMPLETED">완료</SelectItem>
                    <SelectItem value="ON_HOLD">보류</SelectItem><SelectItem value="CANCELLED">취소</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
