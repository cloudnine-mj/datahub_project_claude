"use client";
import{useEffect,useState}from"react";
import{Card,CardContent,CardHeader,CardTitle}from"@/components/ui/card";
import{Button}from"@/components/ui/button";
import{Badge}from"@/components/ui/badge";
import{Input}from"@/components/ui/input";
import{Label}from"@/components/ui/label";
import{Select,SelectContent,SelectItem,SelectTrigger,SelectValue}from"@/components/ui/select";
import{Switch}from"@/components/ui/switch";
import{Settings,Plus,Trash2}from"lucide-react";

const typeL:any={PROJECT:"프로젝트",LAB:"랩",TECH_CELL:"테크셀",PROJECT_TECH_CELL:"프로젝트+테크셀"};
export default function AdminSettingsPage(){
const[configs,setConfigs]=useState<any[]>([]);const[ld,setLd]=useState(true);const[saving,setSaving]=useState<string|null>(null);
const load=()=>fetch("/api/admin/settings").then(r=>r.ok?r.json():[]).then(d=>setConfigs(Array.isArray(d)?d:[])).catch(()=>{}).finally(()=>setLd(false));
useEffect(()=>{load();},[]);
const toggleActive=async(id:string,active:boolean)=>{
setSaving(id);try{await fetch(`/api/admin/settings/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive:!active})});load();}catch{}finally{setSaving(null)}};
const updateSteps=async(id:string,steps:any[])=>{
setSaving(id);try{await fetch(`/api/admin/settings/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({steps})});load();}catch{}finally{setSaving(null)}};
return(<div className="space-y-6">
<div><h1 className="text-2xl font-bold text-gray-900">시스템 설정</h1><p className="text-gray-500">결재 설정을 관리합니다.</p></div>
{ld?<p className="py-8 text-center text-gray-500">불러오는 중...</p>:configs.length===0?<p className="py-8 text-center text-gray-500">설정이 없습니다.</p>:
configs.map(cfg=>{
const steps=Array.isArray(cfg.steps)?cfg.steps:[];
return(<Card key={cfg.id}>
<CardHeader><div className="flex items-center justify-between">
<CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5"/>{typeL[cfg.type]||cfg.type} 결재 설정</CardTitle>
<div className="flex items-center gap-3">
<Badge variant={cfg.isActive?"default":"secondary"}>{cfg.isActive?"활성":"비활성"}</Badge>
<Button variant="outline" size="sm" onClick={()=>toggleActive(cfg.id,cfg.isActive)} disabled={saving===cfg.id}>{cfg.isActive?"비활성화":"활성화"}</Button>
</div></div></CardHeader>
<CardContent className="space-y-4">
<Label className="text-sm font-medium">결재 단계</Label>
{steps.map((step:any,i:number)=>(
<div key={i} className="flex items-center gap-3 rounded border p-3">
<span className="text-sm font-bold text-gray-400 w-6">{i+1}</span>
<Input className="flex-1" value={step.role||step.name||""} onChange={e=>{const ns=[...steps];ns[i]={...ns[i],role:e.target.value,name:e.target.value};updateSteps(cfg.id,ns);}} placeholder="역할"/>
<Button variant="ghost" size="sm" className="text-red-500" onClick={()=>{const ns=steps.filter((_:any,j:number)=>j!==i);updateSteps(cfg.id,ns);}}><Trash2 className="h-3 w-3"/></Button>
</div>))}
<Button variant="outline" size="sm" onClick={()=>{const ns=[...steps,{role:"",name:"",order:steps.length+1}];updateSteps(cfg.id,ns);}}><Plus className="mr-1 h-3 w-3"/>단계 추가</Button>
</CardContent></Card>);})}
</div>);}
