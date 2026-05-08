"use client";

// 화면 10: 신청서 작성 폼 — schema 기반 자동 렌더링.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronDown, Calendar, Save, Upload, X } from "lucide-react";
import { api, type FormType } from "@/lib/api";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/formSchemas";
import { findFirstEmptyRequired } from "@/lib/formValidation";
import { Breadcrumb } from "./Breadcrumb";

const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function FormBuilder({ formType }: { formType: FormType }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?id=N 가 있으면 수정 모드 — 기존 신청서를 읽어 폼 prefill 후 PATCH 로 저장.
  const editId = searchParams?.get("id");
  const isEdit = !!editId;

  const schema = FORM_SCHEMAS[formType];
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // missingField: { label, blocking }
  // - blocking=true: 신규 정식 제출에서 빈 필드 발견 → 저장 차단 (확인만)
  // - blocking=false: 수정 저장에서 빈 필드 발견 → 저장 가능, '그대로 저장' 옵션
  const [missingField, setMissingField] = useState<{ label: string; blocking: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 신청자 정보 — 로그인 사용자 정보로 자동 입력. 사용자가 직접 수정 가능.
  const [submitterName, setSubmitterName] = useState("");
  const [submitterDepartment, setSubmitterDepartment] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  useEffect(() => {
    if (isEdit) return; // 수정 모드는 기존 신청서 값 우선
    api
      .me()
      .then((m) => {
        // 사용자가 아직 직접 입력하지 않았을 때만 default 적용.
        // (이미 타이핑 중이었다면 덮어쓰지 않음)
        setSubmitterName((prev) => prev || m.user.name);
        setSubmitterDepartment((prev) => prev || (m.user.department ?? ""));
        setSubmitterEmail((prev) => prev || m.user.email);
      })
      .catch(() => {
        /* 로그인 정보 없으면 빈 상태 유지 */
      });
  }, [isEdit]);

  // 수정 모드 — 기존 신청서 prefill
  useEffect(() => {
    if (!editId) return;
    api
      .getForm(Number(editId))
      .then((f) => {
        setValues(f.payload || {});
        setSubmitterName(f.submitter_name || "");
        setSubmitterDepartment(f.submitter_department || "");
        setSubmitterEmail(f.submitter_email || "");
      })
      .catch((e) => setError((e as Error).message));
  }, [editId]);

  // 작성 예시 모달
  const [exampleOpen, setExampleOpen] = useState(false);

  // 진행률 계산 — 신청자 정보(3) + schema 모든 필드.
  // 값이 비어있지 않으면 작성된 것으로 카운트 (boolean false 도 작성된 걸로 간주 X).
  // (변수명 'progress' 는 파일 업로드 메시지 useState 와 충돌하므로 'completion' 사용)
  const completion = useMemo(() => {
    const allFields = schema.sections.flatMap((s) => s.fields);
    const filledSchemaFields = allFields.filter((f) => {
      const v = values[f.key];
      if (v === undefined || v === null) return false;
      if (typeof v === "string") return v.trim().length > 0;
      if (typeof v === "boolean") return v === true;
      if (Array.isArray(v)) return v.some((x) => typeof x === "string" && x.trim().length > 0);
      if (typeof v === "object") return Object.values(v).some((x) => typeof x === "string" && x.trim().length > 0);
      return true;
    }).length;
    const filledSubmitter = [submitterName, submitterDepartment, submitterEmail]
      .filter((s) => s.trim().length > 0).length;

    const total = allFields.length + 3; // +3 for submitter info
    const filled = filledSchemaFields + filledSubmitter;
    const percent = total > 0 ? Math.round((filled / total) * 100) : 0;

    // 섹션 진행 — '신청자 정보' 1개 + schema sections.
    const totalSections = schema.sections.length + 1;
    const startedSections =
      (filledSubmitter > 0 ? 1 : 0) +
      schema.sections.filter((s) => s.fields.some((f) => {
        const v = values[f.key];
        if (v === undefined || v === null) return false;
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "boolean") return v === true;
        return true;
      })).length;

    return { filled, total, percent, startedSections, totalSections };
  }, [values, submitterName, submitterDepartment, submitterEmail, schema]);

  function setField(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" 은(는) 50MB 를 초과합니다.`);
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save(asDraft: boolean, force: boolean = false) {
    setError(null);

    // 수정 모드는 항상 draft 로 저장 — 사용자가 detail 에서 '제출' 버튼으로 명시적으로 재제출
    const willBeDraft = asDraft || isEdit;

    // 검증:
    //  - 신규 정식 제출: 누락 시 차단 (blocking)
    //  - 수정 저장: 누락 시 경고만 (non-blocking) — '그대로 저장' 으로 진행 가능
    //  - 신규 임시저장(asDraft): 검증 없음
    const shouldValidate = !asDraft;
    if (shouldValidate && !force) {
      const missing = findFirstEmptyRequired(schema, values, {
        submitterName,
        submitterDepartment,
        submitterEmail,
      });
      if (missing) {
        setMissingField({ label: missing, blocking: !willBeDraft });
        return;
      }
    }

    setSubmitting(true);
    try {
      // projectField 가 service_blocks 같은 array 라면 첫 항목의 service_name 으로 매핑
      const rawProject = values[schema.projectField];
      let projectName = "(미입력)";
      if (Array.isArray(rawProject) && rawProject.length > 0 && typeof rawProject[0] === "object") {
        const first = rawProject[0] as Record<string, unknown>;
        const name = first.service_name;
        if (typeof name === "string" && name.trim()) projectName = name.trim();
      } else if (rawProject) {
        projectName = String(rawProject);
      }
      setProgress(
        willBeDraft
          ? isEdit
            ? "수정 저장 중..."
            : "임시저장 중..."
          : "신청서 제출 중...",
      );

      const body = {
        form_type: formType,
        project_name: projectName,
        payload: values,
        status: willBeDraft ? "draft" : "submitted",
        submitter_name: submitterName || undefined,
        submitter_email: submitterEmail || undefined,
        submitter_department: submitterDepartment || undefined,
      };

      const result = isEdit
        ? await api.updateForm(Number(editId), body)
        : await api.submitForm(body);

      // 파일은 신청서 저장 후 순차 업로드 — 한 파일 실패해도 나머지 그대로 시도.
      // 수정 모드에서도 새로 추가한 파일만 업로드 (기존 첨부는 그대로).
      for (let i = 0; i < files.length; i++) {
        setProgress(`파일 업로드 중 (${i + 1}/${files.length}): ${files[i].name}`);
        try {
          await api.uploadFormAttachment(result.id, files[i]);
        } catch (e) {
          // 일부 파일만 실패해도 사용자에게 알리고 계속
          console.error(`업로드 실패 (${files[i].name}):`, e);
        }
      }

      if (isEdit) {
        // 수정 저장 후 detail 로 — just-edited 플래그로 detail 의 '제출' 버튼 노출 트리거
        router.push(`/governance/forms/detail/${result.id}?just-edited=1`);
      } else if (asDraft) {
        // 신규 임시저장 → 바로 내 문서 목록으로. detail 은 어차피 거기서 수정 가능.
        router.push(`/governance/forms/my`);
      } else {
        router.push(`/governance/forms/submitted?id=${result.id}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
      setProgress(null);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save(false);
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "데이터 거버넌스 문서 서식 모음", href: "/governance/forms" },
          { label: schema.label },
        ]}
      />

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {schema.label}
            {isEdit && <span className="ml-2 text-base font-semibold text-gray-400">(수정)</span>}
          </h1>
          <button
            type="button"
            onClick={() => setExampleOpen(true)}
            className="inline-flex shrink-0 items-center rounded-md border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
          >
            작성 예시
          </button>
        </div>

        {/* 진행률 안내 */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <div className="inline-flex items-center gap-1.5 text-gray-600">
              Step{" "}
              <strong className="font-semibold text-gray-800">
                {completion.startedSections} / {completion.totalSections}
              </strong>
              <span className="text-gray-400">진행 중</span>
            </div>
            <span className="hidden text-gray-300 sm:inline">·</span>
            <div className="text-gray-600">
              <strong className="font-semibold text-gray-800">{completion.filled}</strong>
              <span className="text-gray-400"> / {completion.total} 필드</span>
            </div>
          </div>

          {/* progress bar */}
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${completion.percent}%` }}
            />
          </div>
          <div className="mt-1 text-right text-[11px] font-semibold text-blue-600">
            {completion.percent}% 완료
          </div>
        </div>
      </div>

      <form id="form-builder" onSubmit={onSubmit} className="space-y-8">
        {/* 신청자 정보 — 기본은 로그인 사용자, 직접 수정 가능 */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="block h-5 w-1 rounded-sm bg-brand" />
            <h2 className="text-base font-bold">신청자 정보</h2>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <tbody>
                <SubmitterInputRow
                  label="신청자 이름"
                  value={submitterName}
                  onChange={setSubmitterName}
                  placeholder="이름을 입력하세요"
                />
                <SubmitterInputRow
                  label="소속"
                  value={submitterDepartment}
                  onChange={setSubmitterDepartment}
                  placeholder="소속을 입력하세요"
                />
                <SubmitterInputRow
                  label="이메일"
                  value={submitterEmail}
                  onChange={setSubmitterEmail}
                  placeholder="이메일을 입력하세요"
                  type="email"
                />
              </tbody>
            </table>
          </div>
        </section>

        {schema.sections.map((section, sectionIdx) => {
          // 풀 와이드 단독 필드 (service_blocks 등) — 표/섹션헤더 없이 렌더
          if (
            section.fields.length === 1 &&
            section.fields[0].type === "service_blocks"
          ) {
            const f = section.fields[0];
            return (
              <section key={`bare-${sectionIdx}`}>
                <FieldInput
                  field={f}
                  value={values[f.key]}
                  onChange={(v) => setField(f.key, v)}
                  allValues={values}
                />
              </section>
            );
          }

          // inlineWithNext 적용 — 두 필드를 같은 행에 묶기 위한 사전 그룹핑.
          type Row = { primary: FieldDef; inline?: FieldDef };
          const rows: Row[] = [];
          for (let i = 0; i < section.fields.length; i++) {
            const f = section.fields[i];
            if (f.inlineWithNext && i + 1 < section.fields.length) {
              rows.push({ primary: f, inline: section.fields[i + 1] });
              i++; // 다음 필드는 인라인으로 흡수됐으니 별도 행 X
            } else {
              rows.push({ primary: f });
            }
          }

          return (
            <section key={section.title || `s-${sectionIdx}`}>
              <div className="mb-3 flex items-center gap-2">
                <span className="block h-5 w-1 rounded-sm bg-brand" />
                <h2 className="text-base font-bold">
                  {section.title}
                  {!section.optional && <span className="ml-1 text-brand">*</span>}
                </h2>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map(({ primary: f, inline }) => {
                      // 체크박스는 라벨이 input 옆에 이미 있으므로 좌측 라벨 셀 생략 (중복 방지)
                      if (f.type === "checkbox") {
                        return (
                          <tr key={f.key} className="border-b border-gray-100 last:border-b-0">
                            <td colSpan={2} className="px-5 py-3">
                              <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} allValues={values} />
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={f.key} className="border-b border-gray-100 last:border-b-0">
                          <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">
                            {f.label}
                          </td>
                          <td className="px-5 py-3">
                            {inline ? (
                              <div className="flex items-center gap-3">
                                <div className="flex-1">
                                  <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} allValues={values} />
                                </div>
                                <span className="shrink-0 text-sm text-gray-600">{inline.label}</span>
                                <div className="flex-1">
                                  <FieldInput
                                    field={inline}
                                    value={values[inline.key]}
                                    onChange={(v) => setField(inline.key, v)}
                                    allValues={values}
                                  />
                                </div>
                              </div>
                            ) : (
                              <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} allValues={values} />
                            )}
                            <FieldHint field={f} />
                            {inline && <FieldHint field={inline} />}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="block h-5 w-1 rounded-sm bg-brand" />
            <h2 className="text-base font-bold">파일 첨부</h2>
          </div>

          {/* 드래그&드롭 + 클릭 업로드 영역 */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={
              "cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition " +
              (dragActive ? "border-brand bg-brand/5" : "border-blue-300 bg-blue-50/30 hover:border-brand/60 hover:bg-blue-50/50")
            }
          >
            <Upload size={20} className="mx-auto text-gray-400" />
            <p className="mt-2 text-sm font-semibold">파일을 드래그하거나 클릭하여 업로드하세요</p>
            <p className="mt-1 text-xs text-gray-500">샘플 데이터, 작업 가이드라인 등 첨부 가능 · 최대 50MB</p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold">
              📎 파일 선택
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) addFiles(e.target.files);
                e.target.value = "";  // 같은 파일 다시 선택 가능하게
              }}
            />
          </div>

          {/* 선택된 파일 목록 */}
          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-gray-400">📎</span>
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="shrink-0 text-xs text-gray-400">{formatBytes(f.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(i);
                    }}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                    aria-label="제거"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {progress && <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{progress}</div>}

        <div className="flex justify-end gap-2">
          {!isEdit && (
            <button
              type="button"
              onClick={() => save(true)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              임시저장
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            <Save size={14} /> {submitting ? (isEdit ? "수정 중..." : "제출 중...") : (isEdit ? "수정 저장" : "제출")}
          </button>
        </div>
      </form>

      {/* 필수 항목 누락 알림 모달
            blocking=true (신규 제출): 확인만 — 저장 차단
            blocking=false (수정 저장): '그대로 저장' 으로 부분 저장 가능 */}
      {missingField && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setMissingField(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-amber-600">
                  <AlertCircle size={18} />
                </span>
                <h3 className="text-base font-bold">필수 항목 누락</h3>
              </div>
              <button
                type="button"
                onClick={() => setMissingField(null)}
                aria-label="닫기"
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              <strong className="font-semibold text-gray-800">&apos;{missingField.label}&apos;</strong> 항목을 입력해주세요.
              {!missingField.blocking && (
                <span className="mt-1 block text-xs text-gray-500">
                  비워둔 채로 저장하면 임시저장 상태로 보관됩니다.
                </span>
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {missingField.blocking ? (
                <button
                  type="button"
                  onClick={() => setMissingField(null)}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  확인
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setMissingField(null)}
                    className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
                  >
                    돌아가서 입력
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMissingField(null);
                      // force=true 로 검증 우회하고 그대로 저장 (수정 저장 = draft)
                      save(false, true);
                    }}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
                  >
                    그대로 저장
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 작성 예시 모달 — 현재 placeholder, 향후 신청서별 예시 데이터 연결 */}
      {exampleOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => setExampleOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                작성 예시
              </div>
              <button
                type="button"
                onClick={() => setExampleOpen(false)}
                aria-label="닫기"
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </div>
            <h3 className="mt-2 text-base font-bold">{schema.label}</h3>
            <p className="mt-3 text-sm text-gray-600">
              이 신청서의 작성 예시는 곧 추가될 예정입니다. 작성 시 도움이 필요하면
              관리자에게 문의해 주세요.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setExampleOpen(false)}
                className="rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  allValues,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  /** amount_with_currency 처럼 다른 필드의 값을 참조하는 타입에 사용 */
  allValues?: Record<string, unknown>;
}) {
  const common = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none";
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
        />
      );
    case "date":
      return <DateField value={(value as string) ?? ""} onChange={(v) => onChange(v)} />;
    case "number":
      return (
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
        />
      );
    case "radio":
      return (
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={field.key}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="text-brand focus:ring-brand"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded text-brand focus:ring-brand"
          />
          <span className="text-gray-700">{field.label}</span>
        </label>
      );
    case "select":
      return (
        <div className="relative">
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={common + " appearance-none bg-white pr-9"}
          >
            <option value="">선택하세요</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
        </div>
      );
    case "service_list":
      return (
        <ServiceListField
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      );
    case "date_range": {
      const v = (value as { start?: string; end?: string }) ?? {};
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <DateField value={v.start ?? ""} onChange={(s) => onChange({ ...v, start: s })} />
          </div>
          <span className="shrink-0 text-sm text-gray-400">~</span>
          <div className="flex-1">
            <DateField value={v.end ?? ""} onChange={(s) => onChange({ ...v, end: s })} />
          </div>
        </div>
      );
    }
    case "currency":
      return (
        <CurrencyField
          value={(value as { kind?: string; custom?: string }) ?? {}}
          onChange={(v) => onChange(v)}
        />
      );
    case "service_blocks":
      return (
        <ServiceBlocksField
          value={Array.isArray(value) ? (value as ServiceBlock[]) : []}
          onChange={(v) => onChange(v)}
        />
      );
    case "amount_with_currency": {
      const currency = field.currencyKey
        ? (allValues?.[field.currencyKey] as { kind?: string; custom?: string } | undefined)
        : undefined;
      return (
        <AmountWithCurrencyInput
          value={(value as string) ?? ""}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
          currency={currency}
        />
      );
    }
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={common}
        />
      );
  }
}

/**
 * 날짜 입력 — 텍스트 입력 + 달력 아이콘 버튼.
 *
 * 기본 `<input type="date">` 의 브라우저 placeholder ("연도. 월. 일.") 를
 * 우회하기 위한 하이브리드 컴포넌트:
 *  - 비어있을 때: "날짜를 선택하세요" 안내
 *  - 자유 타이핑 가능 (YYYY-MM-DD, 2026-04-30 등)
 *  - 달력 아이콘 클릭 시 네이티브 date picker 열림 (showPicker API)
 *  - picker 로 선택 후에도 텍스트 input 으로 수동 수정 가능
 */
function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // 일부 브라우저는 보안상 throw — fallback
      }
    }
    el.click();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openPicker}
        aria-label="달력 열기"
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <Calendar size={14} />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="날짜를 선택하세요"
        className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none"
      />
      {/* hidden native date — left:0 으로 명시해 picker 가 좌측(아이콘 옆)에 뜨도록 */}
      <input
        ref={dateInputRef}
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute left-2 top-1/2 h-0 w-0 -translate-y-1/2 opacity-0"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

/**
 * 필드 아래 안내 텍스트(hint) + 선택적 외부 링크(hintLink) 렌더.
 *
 * hint 에 `{link}` 토큰이 있으면 그 자리에 클릭 가능한 링크가 인라인으로 들어감.
 * 토큰이 없으면 hint 아래에 별도 줄로 링크 표시.
 */
function FieldHint({ field }: { field: FieldDef }) {
  if (!field.hint && !field.hintLink) return null;

  const link = field.hintLink ? (
    <a
      href={field.hintLink.url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-blue-600 underline-offset-2 hover:underline"
    >
      {field.hintLink.label}
    </a>
  ) : null;

  // hint 안에 {link} 토큰 — 인라인 링크 삽입
  if (field.hint && link && field.hint.includes("{link}")) {
    const [before, after] = field.hint.split("{link}");
    return (
      <p className="mt-1.5 text-xs font-semibold text-gray-500">
        {before}
        {link}
        {after}
      </p>
    );
  }

  // 토큰 없음 — hint 텍스트 + 아래에 별도 링크 줄
  return (
    <div className="mt-1.5">
      {field.hint && <p className="text-xs font-semibold text-gray-500">{field.hint}</p>}
      {link && <div className="mt-1 text-xs">{link} ↗</div>}
    </div>
  );
}

/**
 * 동적 서비스명 리스트 — '+ 서비스 추가' 로 row 추가, X 로 제거.
 * 빈 row 도 항상 1개는 유지 (사용자가 입력할 자리).
 */
function ServiceListField({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const list = value.length > 0 ? value : [""];

  function update(idx: number, v: string) {
    const next = [...list];
    next[idx] = v;
    onChange(next);
  }

  function add() {
    onChange([...list, ""]);
  }

  function remove(idx: number) {
    if (list.length <= 1) {
      onChange([""]);
      return;
    }
    onChange(list.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {list.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-gray-500">서비스명 {i + 1}</span>
          <input
            type="text"
            value={v}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label="서비스 제거"
            className="shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/30 px-5 py-2.5 text-xs font-semibold text-blue-700 hover:border-blue-400 hover:bg-blue-50"
      >
        + 서비스 추가
      </button>
    </div>
  );
}

/**
 * 결제 통화 — USD / KRW / [EUR·JPY·기타 dropdown].
 * '그 외' 라디오 선택 시 dropdown 활성. dropdown 에서 '기타' 고르면 자유 입력 텍스트.
 */
function CurrencyField({
  value,
  onChange,
}: {
  value: { kind?: string; custom?: string };
  onChange: (next: { kind?: string; custom?: string }) => void;
}) {
  const kind = value.kind ?? "";
  const isFromDropdown = kind === "EUR" || kind === "JPY" || kind === "기타";

  return (
    <div className="flex flex-wrap items-center gap-4">
      {(["USD", "KRW"] as const).map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="currency"
            value={opt}
            checked={kind === opt}
            onChange={() => onChange({ kind: opt })}
            className="text-brand focus:ring-brand"
          />
          {opt}
        </label>
      ))}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="radio"
          name="currency"
          checked={isFromDropdown}
          onChange={() => onChange({ kind: "EUR" })} // dropdown 활성화 후 default = EUR
          className="text-brand focus:ring-brand"
        />
        그 외
      </label>
      <select
        value={isFromDropdown ? kind : ""}
        disabled={!isFromDropdown}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ kind: v, custom: v === "기타" ? "" : undefined });
        }}
        className="w-28 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
      >
        <option value="EUR">EUR</option>
        <option value="JPY">JPY</option>
        <option value="기타">기타</option>
      </select>
      {kind === "기타" && (
        <input
          type="text"
          value={value.custom ?? ""}
          onChange={(e) => onChange({ ...value, custom: e.target.value.toUpperCase() })}
          placeholder="예: GBP"
          maxLength={5}
          className="w-24 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand focus:outline-none"
        />
      )}
    </div>
  );
}

/**
 * 업무생산성 도구 신청서 — 서비스 블록 동적 리스트.
 *
 * 각 블록: 서비스명 / 활용 방안 / 결제 통화 / 예상 비용 / 결제 방식 / 사용 인원(이름 칩) / 인원 수(자동) / 총 비용(자동).
 * 인원 수 = members.length, 총 비용 = parse(예상 비용 숫자) × 인원 수.
 */
type ServiceBlock = {
  service_name: string;
  usage: string;
  currency: { kind?: string; custom?: string };
  cost: string;
  payment_method: string;
  members: string[];
};

const EMPTY_BLOCK: ServiceBlock = {
  service_name: "",
  usage: "",
  currency: {},
  cost: "",
  payment_method: "",
  members: [],
};

function ServiceBlocksField({
  value,
  onChange,
}: {
  value: ServiceBlock[];
  onChange: (next: ServiceBlock[]) => void;
}) {
  const list = value.length > 0 ? value : [EMPTY_BLOCK];

  function update(idx: number, patch: Partial<ServiceBlock>) {
    const next = list.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onChange(next);
  }

  function add() {
    onChange([...list, { ...EMPTY_BLOCK }]);
  }

  function remove(idx: number) {
    if (list.length <= 1) {
      onChange([{ ...EMPTY_BLOCK }]);
      return;
    }
    onChange(list.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-4">
      {list.map((block, idx) => (
        <ServiceBlockCard
          key={idx}
          index={idx}
          block={block}
          onChange={(patch) => update(idx, patch)}
          onRemove={() => remove(idx)}
        />
      ))}
      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50/30 px-5 py-4 text-sm font-semibold text-blue-700 hover:border-blue-400 hover:bg-blue-50"
      >
        + 서비스 추가
      </button>
    </div>
  );
}

function ServiceBlockCard({
  index,
  block,
  onChange,
  onRemove,
}: {
  index: number;
  block: ServiceBlock;
  onChange: (patch: Partial<ServiceBlock>) => void;
  onRemove: () => void;
}) {
  const memberCount = block.members.length;
  const totalCost = computeTotal(block.cost, memberCount, block.currency);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/40 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="block h-5 w-1 rounded-sm bg-brand" />
          <h3 className="text-sm font-bold">서비스 {index + 1}</h3>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="서비스 제거"
          className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
        >
          <X size={14} />
        </button>
      </div>
      <table className="w-full text-sm">
        <tbody>
          <BlockRow label="서비스명">
            <input
              type="text"
              value={block.service_name}
              onChange={(e) => onChange({ service_name: e.target.value })}
              placeholder="예: Claude API"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </BlockRow>
          <BlockRow label="활용 방안">
            <textarea
              rows={2}
              value={block.usage}
              onChange={(e) => onChange({ usage: e.target.value })}
              placeholder="예: 내부 데이터 분석 자동화 및 AI 리포트 생성"
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
            />
          </BlockRow>
          <BlockRow label="결제 통화">
            <CurrencyField
              value={block.currency}
              onChange={(c) => onChange({ currency: c })}
            />
          </BlockRow>
          <BlockRow label="예상 비용">
            <AmountWithCurrencyInput
              value={block.cost}
              onChange={(v) => onChange({ cost: v })}
              placeholder="예: 5,000"
              currency={block.currency}
            />
          </BlockRow>
          <BlockRow label="결제 방식">
            <div className="flex flex-wrap items-center gap-5">
              {["월 구독", "연 구독", "구매"].map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`payment-${index}`}
                    value={opt}
                    checked={block.payment_method === opt}
                    onChange={() => onChange({ payment_method: opt })}
                    className="text-brand focus:ring-brand"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </BlockRow>
          <BlockRow label="사용자">
            <MemberChipsField
              members={block.members}
              onChange={(members) => onChange({ members })}
            />
          </BlockRow>
          <BlockRow label="인원 수">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-900">{memberCount}</span>
              <span className="text-gray-500">명</span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                사용자 수 자동 계산
              </span>
            </div>
          </BlockRow>
          <BlockRow label="총 비용">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-gray-900">
                {totalCost ?? <span className="text-gray-300">—</span>}
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                예상 비용 × 인원 수
              </span>
            </div>
          </BlockRow>
        </tbody>
      </table>
    </div>
  );
}

function BlockRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="w-32 bg-gray-50/40 px-5 py-3 align-top text-gray-700">{label}</td>
      <td className="px-5 py-3">{children}</td>
    </tr>
  );
}

/** 사용 인원 — 이름 칩 + 추가 input. Enter 로 추가, 칩 클릭으로 제거. */
/**
 * 통화 단위에 맞는 prefix/suffix 가 붙는 금액 입력.
 *
 *  - USD : 좌측에 '$' prefix
 *  - KRW : 우측에 '원' suffix
 *  - 기타 + custom 입력값 : 우측에 그 값 suffix (예: 'EUR')
 *  - 미선택 : 일반 input
 */
/**
 * 통화 코드 → 표시 prefix 매핑.
 * 매핑이 없으면 코드 자체 (e.g., "AUD ").
 */
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  KRW: "₩",
  EUR: "€",
  JPY: "¥",
  CNY: "¥",
  GBP: "£",
  HKD: "HK$",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
  CHF: "CHF",
  TWD: "NT$",
  INR: "₹",
  VND: "₫",
  THB: "฿",
  IDR: "Rp",
  MYR: "RM",
  PHP: "₱",
};

/** kind/custom 조합으로 prefix 문자열 결정. 빈값/매칭 안되면 null. */
function currencyPrefix(currency: { kind?: string; custom?: string } | undefined): string | null {
  const kind = currency?.kind;
  if (!kind) return null;
  if (kind === "기타") {
    const code = currency?.custom?.trim();
    if (!code) return null;
    return CURRENCY_SYMBOL[code] ?? code;
  }
  return CURRENCY_SYMBOL[kind] ?? kind;
}

function AmountWithCurrencyInput({
  value,
  onChange,
  placeholder,
  currency,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  currency: { kind?: string; custom?: string } | undefined;
}) {
  const prefix = currencyPrefix(currency);

  const base =
    "w-full rounded-md border border-gray-200 py-2 text-sm focus:border-brand focus:outline-none";
  const padX = (prefix ? "pl-8 " : "pl-3 ") + "pr-3";

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 max-w-[60px] truncate text-sm text-gray-500">
          {prefix}
        </span>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(formatThousands(e.target.value))}
        placeholder={placeholder}
        className={`${base} ${padX}`}
      />
    </div>
  );
}

/** 입력 문자열에서 숫자/점만 남기고 정수부에 천 단위 콤마. 빈 입력은 빈 문자열. */
function formatThousands(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  if (!cleaned) return "";
  const [intPart, ...rest] = cleaned.split(".");
  const decimal = rest.length > 0 ? "." + rest.join("") : "";
  const formattedInt = intPart ? Number(intPart).toLocaleString("en-US") : "";
  return formattedInt + decimal;
}

function MemberChipsField({
  members,
  onChange,
}: {
  members: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (members.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...members, v]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(members.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {members.map((m, i) => (
        <button
          key={`${m}-${i}`}
          type="button"
          onClick={() => remove(i)}
          className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          title="클릭하여 제거"
        >
          {m}
        </button>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          // 한글 IME 조합 중 Enter — composition 종료용이므로 무시
          if (e.nativeEvent.isComposing || e.key === "Process") return;
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={members.length === 0 ? "여러 명 추가 가능 — 이름 입력 후 Enter (예: 홍길동)" : ""}
        className="min-w-[140px] flex-1 rounded-md border-0 bg-transparent px-2 py-1 text-sm placeholder:text-gray-400 focus:outline-none"
      />
    </div>
  );
}

/** "예상 비용" 문자열에서 숫자 부분을 추출해 인원 수와 곱한 뒤 통화 기호와 함께 포맷. */
function computeTotal(
  costStr: string,
  count: number,
  currency?: { kind?: string; custom?: string },
): string | null {
  if (!costStr || count <= 0) return null;
  const match = costStr.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  if (!Number.isFinite(n)) return null;
  const total = Math.round(n * count);
  const formatted = total.toLocaleString();
  const prefix = currencyPrefix(currency);
  if (!prefix) return formatted;
  // 짧은 심볼($, ₩, € 등) 은 붙이고, 긴 심볼(HK$, A$, 'CHF' 등) 은 공백 한 칸
  return prefix.length <= 1 ? `${prefix}${formatted}` : `${prefix} ${formatted}`;
}

function SubmitterInputRow({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email";
}) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">{label}</td>
      <td className="px-5 py-3">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      </td>
    </tr>
  );
}
