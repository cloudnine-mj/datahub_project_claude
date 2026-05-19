"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  VisibilitySelector,
  presetForFineGrained,
} from "@/components/repo/VisibilitySelector";
import type { PublicAccess, VisibilityMode } from "@/lib/platform-client";

interface MetaItem {
  id: string;
  name: string;
}

interface UserSearchResult {
  id: number;
  email: string;
  name: string;
}

// ── Generic single-select dropdown ────────────────────────────────────────────

function SelectDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: MetaItem[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.id === value);

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label className="text-sm font-medium text-text-primary">{label}</Label>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <span className={selected ? "text-text-primary" : "text-text-muted"}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 text-text-muted" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-56 overflow-auto rounded-md border border-dh-border bg-white shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex w-full items-center px-3 py-2 text-sm hover:bg-bg-surface"
              onClick={() => { onChange(opt.id); setOpen(false); }}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Generic multi-select ───────────────────────────────────────────────────────

function MultiSelect({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: MetaItem[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(
    (o) =>
      !selected.includes(o.id) &&
      o.name.toLowerCase().includes(q.toLowerCase()),
  );

  function toggle(id: string) {
    if (selected.includes(id)) onChange(selected.filter((s) => s !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label className="text-sm font-medium text-text-primary">{label}</Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map((id) => {
            const item = options.find((o) => o.id === id);
            return (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full bg-accent-blue/10 px-2.5 py-0.5 text-xs text-accent-blue"
              >
                {item?.name ?? id}
                <button type="button" onClick={() => toggle(id)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
        <input
          className="w-full rounded-md border border-input bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-64 overflow-auto rounded-md border border-dh-border bg-white shadow-lg">
          {filtered.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="flex w-full items-center px-3 py-2 text-sm hover:bg-bg-surface"
              onClick={() => { toggle(opt.id); setQ(""); }}
            >
              {opt.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Contributors multi-select (user search) ───────────────────────────────────

function ContributorsSelect({
  selected,
  onChange,
}: {
  selected: UserSearchResult[];
  onChange: (v: UserSearchResult[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim()) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [q]);

  function remove(id: number) {
    onChange(selected.filter((u) => u.id !== id));
  }

  function add(user: UserSearchResult) {
    if (!selected.find((u) => u.id === user.id)) onChange([...selected, user]);
    setQ("");
    setResults([]);
  }

  return (
    <div className="space-y-1.5" ref={ref}>
      <Label className="text-sm font-medium text-text-primary">
        Contributors
        <span className="ml-1 text-xs text-text-muted font-normal">(선택)</span>
      </Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1">
          {selected.map((u) => (
            <span
              key={u.id}
              className="flex items-center gap-1 rounded-full bg-accent-blue/10 px-2.5 py-0.5 text-xs text-accent-blue"
            >
              {u.name}
              <button type="button" onClick={() => remove(u.id)}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
        <input
          className="w-full rounded-md border border-input bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="이메일 또는 이름으로 검색..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && (loading || results.length > 0) && (
        <div className="absolute z-20 mt-1 max-h-48 w-64 overflow-auto rounded-md border border-dh-border bg-white shadow-lg">
          {loading ? (
            <p className="px-3 py-2 text-xs text-text-muted">검색 중...</p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                type="button"
                className="flex w-full flex-col items-start px-3 py-2 text-sm hover:bg-bg-surface"
                onClick={() => add(u)}
              >
                <span className="font-medium">{u.name}</span>
                <span className="text-xs text-text-muted">{u.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function NewModelPage() {
  const router = useRouter();

  // Card 1
  const [repoName, setRepoName] = useState("");
  const [visibility, setVisibility] = useState<VisibilityMode>("public");
  const [publicAccess, setPublicAccess] = useState<PublicAccess>(
    presetForFineGrained(),
  );
  const [description, setDescription] = useState("");
  const [license, setLicense] = useState("");
  const [contributors, setContributors] = useState<UserSearchResult[]>([]);

  // Card 2
  const [tasks, setTasks] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [frameworks, setFrameworks] = useState<string[]>([]);
  const [orgProject, setOrgProject] = useState("");
  const [orgTechCell, setOrgTechCell] = useState("");
  const [orgName, setOrgName] = useState("");

  // Card 3
  const [aiCard, setAiCard] = useState(false);
  const [aiMetadata, setAiMetadata] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Meta data
  const [licenseOptions, setLicenseOptions] = useState<MetaItem[]>([]);
  const [taskOptions, setTaskOptions] = useState<MetaItem[]>([]);
  const [langOptions, setLangOptions] = useState<MetaItem[]>([]);
  const [frameworkOptions, setFrameworkOptions] = useState<MetaItem[]>([]);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [lic, tsk, lng, frm] = await Promise.all([
          fetch("/api/meta/licenses").then((r) => r.json()),
          fetch("/api/meta/tasks").then((r) => r.json()),
          fetch("/api/meta/languages").then((r) => r.json()),
          fetch("/api/meta/frameworks").then((r) => r.json()),
        ]);
        setLicenseOptions(Array.isArray(lic) ? lic : []);
        setTaskOptions(Array.isArray(tsk) ? tsk : []);
        setLangOptions(Array.isArray(lng) ? lng : []);
        setFrameworkOptions(Array.isArray(frm) ? frm : []);
      } catch {
        // meta is best-effort
      }
    }
    loadMeta();
  }, []);

  const handleCreate = async () => {
    if (!repoName.trim()) return;
    setSubmitting(true);
    setError(null);

    const group = [orgProject, orgTechCell, orgName].filter(Boolean).join("/") || undefined;

    try {
      const res = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_name: repoName.trim(),
          description: description.trim() || undefined,
          repo_type: "B", // model
          visibility,
          public_access:
            visibility === "fine_grained" ? publicAccess : undefined,
          group,
          ai_card: aiCard,
          ai_metadata: aiMetadata,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed: ${res.status}`);
      }

      const data = await res.json();
      router.push(`/${data.owner}/${data.repo_name}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          Create a new model repository
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">
          새로운 모델 레포지토리를 생성합니다.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Card 1: Basic Information */}
      <div className="rounded-xl border border-dh-border bg-white p-6 space-y-5">
        <h2 className="font-heading text-[15px] font-semibold text-text-primary">Basic Information</h2>

        <div className="space-y-1.5">
          <Label htmlFor="repo-name" className="text-sm font-medium text-text-primary">
            Repository name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="repo-name"
            placeholder="my-model"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            className="text-sm"
          />
          <p className="text-xs text-text-muted">영문, 숫자, 하이픈(-)만 사용 가능합니다.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm font-medium text-text-primary">
            Description
            <span className="ml-1 text-xs text-text-muted font-normal">(선택)</span>
          </Label>
          <textarea
            id="description"
            rows={3}
            placeholder="모델에 대한 간략한 설명을 입력하세요."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Visibility (3-radio + fine-grained 6 capability) */}
        <VisibilitySelector
          visibility={visibility}
          onVisibilityChange={setVisibility}
          publicAccess={publicAccess}
          onPublicAccessChange={setPublicAccess}
        />

        {/* License dropdown */}
        <div className="relative">
          <SelectDropdown
            label="License"
            placeholder="라이선스 선택..."
            options={licenseOptions}
            value={license}
            onChange={setLicense}
          />
        </div>

        {/* Contributors */}
        <div className="relative">
          <ContributorsSelect selected={contributors} onChange={setContributors} />
        </div>
      </div>

      {/* Card 2: Metadata */}
      <div className="rounded-xl border border-dh-border bg-white p-6 space-y-5">
        <h2 className="font-heading text-[15px] font-semibold text-text-primary">Metadata</h2>

        <div className="relative">
          <MultiSelect
            label="Tasks"
            placeholder="ML task 검색..."
            options={taskOptions}
            selected={tasks}
            onChange={setTasks}
          />
        </div>

        <div className="relative">
          <MultiSelect
            label="Languages"
            placeholder="언어 검색..."
            options={langOptions}
            selected={languages}
            onChange={setLanguages}
          />
        </div>

        <div className="relative">
          <MultiSelect
            label="Frameworks"
            placeholder="프레임워크 검색..."
            options={frameworkOptions}
            selected={frameworks}
            onChange={setFrameworks}
          />
        </div>

        {/* Org Info */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-text-primary">
            Organization Info
            <span className="ml-1 text-xs text-text-muted font-normal">(선택)</span>
          </Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Project</p>
              <Input
                placeholder="프로젝트명"
                value={orgProject}
                onChange={(e) => setOrgProject(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Tech Cell</p>
              <Input
                placeholder="기술 셀"
                value={orgTechCell}
                onChange={(e) => setOrgTechCell(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-text-muted">Organization</p>
              <Input
                placeholder="조직명"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card 3: AI Options */}
      <div className="rounded-xl border border-[#E9D5FF] bg-[#FAF5FF] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <h2 className="font-heading text-[15px] font-semibold text-text-primary">AI 자동 생성 &amp; Options</h2>
        </div>
        <p className="text-xs text-text-secondary">
          AI가 초기 README.md (Model Card)와 메타데이터를 자동으로 생성합니다.
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Model Card 자동 생성</p>
              <p className="text-xs text-text-muted">AI가 README.md를 자동 생성합니다</p>
            </div>
            <Switch checked={aiCard} onCheckedChange={setAiCard} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Metadata 자동 생성</p>
              <p className="text-xs text-text-muted">메타데이터 필드를 AI가 자동으로 채워줍니다</p>
            </div>
            <Switch checked={aiMetadata} onCheckedChange={setAiMetadata} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        <Button variant="outline" onClick={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
        <Button
          className="bg-accent-blue hover:bg-accent-blue/90 text-white"
          onClick={handleCreate}
          disabled={submitting || !repoName.trim()}
        >
          {submitting ? "생성 중..." : "Create Repository"}
        </Button>
      </div>
    </div>
  );
}
