"use client";

// 화면 10: 신청 작성 폼 — schema 기반 자동 렌더링.
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ChevronDown, Calendar, Eye, Save, Upload, X } from "lucide-react";
import { api, type ApprovalEntry, type FormType } from "@/lib/governance/api-client-full";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/governance/forms/schemas";
import { findFirstEmptyRequired } from "@/lib/governance/forms/validation";
import { copyPreviewToClipboard, derivePreviewProjectName } from "@/lib/governance/forms/preview";
import { approverInitials } from "@/lib/governance/forms/utils-bridge";
import { Breadcrumb } from "./Breadcrumb";
import { FormPreviewModal } from "./FormPreviewModal";
import { FormProcessBar } from "./FormProcessBar";
import { NumberInput } from "./NumberInput";

const MAX_BYTES = 50 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// embedded=true 면 자체 Breadcrumb / 제목 / FormProcessBar 를 숨김 — 다른 페이지의 substep 자리에 inline 으로 끼울 때 사용.
export function FormBuilder({
  formType,
  embedded = false,
}: {
  formType: FormType;
  embedded?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?id=N 가 있으면 수정 모드 — 기존 신청을 읽어 폼 prefill 후 PATCH 로 저장.
  const editId = searchParams?.get("id");
  const isEdit = !!editId;
  // 진입 출처 — 브레드크럼 부모를 어디로 보낼지 결정.
  //   from=my    → '내 문서 목록'
  //   from=admin → '거버넌스 요청 관리'
  //   기본        → '데이터 거버넌스 문서 서식 모음' (서식 선택 화면에서 들어온 경우)
  const from = searchParams?.get("from");

  const schema = FORM_SCHEMAS[formType];
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // missingField: { label, blocking }
  // - blocking=true: 신규 정식 제출에서 빈 필드 발견 → 저장 차단 (확인만)
  // - blocking=false: 수정 저장에서 빈 필드 발견 → 저장 가능, '그대로 저장' 옵션
  const [missingField, setMissingField] = useState<{ label: string; blocking: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 요청자 정보 — 로그인 사용자 정보로 자동 입력. 사용자가 직접 수정 가능.
  const [submitterName, setSubmitterName] = useState("");
  const [submitterDepartment, setSubmitterDepartment] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  useEffect(() => {
    if (isEdit) return; // 수정 모드는 기존 신청 값 우선
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

  // 진행 바 표시용 — 신규 작성은 'draft', 편집은 로드된 form 의 status 를 그대로.
  const [loadedStatus, setLoadedStatus] = useState<string>("draft");
  // chevron '승인 완료' 패널의 진행 이력에 표시할 데이터. 편집 모드에서 form 로드 시 채움.
  const [loadedHistory, setLoadedHistory] = useState<ApprovalEntry[] | null>(null);
  // 진행 바에서 선택된 단계 — '요청서 작성'(index 1) 일 때만 양식 폼 노출.
  // 다른 단계 선택 시 양식 숨김 (해당 단계 정보만 보이도록).
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const hideForm = selectedStep !== null && selectedStep !== 1;

  // 수정 모드 — 기존 신청 prefill
  useEffect(() => {
    if (!editId) return;
    api
      .getForm(editId)
      .then((f) => {
        // payload 는 Record 일 수도, 더블 JSON 인코딩된 string 일 수도 있음 — 두 케이스 모두 처리.
        let payload: Record<string, unknown> = {};
        if (f.payload && typeof f.payload === "object" && !Array.isArray(f.payload)) {
          payload = f.payload as Record<string, unknown>;
        } else if (typeof f.payload === "string") {
          try {
            payload = JSON.parse(f.payload as string) as Record<string, unknown>;
          } catch {
            payload = {};
          }
        }
        if (process.env.NODE_ENV !== "production") {
          console.log("[FormBuilder] loaded form for edit:", {
            id: editId,
            payloadKeys: Object.keys(payload),
            submitter: { name: f.submitter_name, dept: f.submitter_department },
          });
        }
        setValues(payload);
        setSubmitterName(f.submitter_name || "");
        setSubmitterDepartment(f.submitter_department || "");
        setSubmitterEmail(f.submitter_email || "");
        setLoadedStatus(f.status || "draft");
        setLoadedHistory(f.approval_history ?? null);
      })
      .catch((e) => setError((e as Error).message));
  }, [editId]);

  // 미리보기 모달 — 작성 중인 값으로 EAS 붙여넣기용 HTML 미리보기 (제출 전 확인).
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);

  // 요청자 정보 섹션 토글 — 기본 접힘. SSO 로 이미 채워져 있으므로 평소엔 가려두고
  // 필요할 때만 펼쳐 확인.
  const [submitterOpen, setSubmitterOpen] = useState(false);

  function setField(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function addFiles(list: FileList | File[]) {
    const arr = Array.from(list);
    const tooBig = arr.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`"${tooBig.name}" 은(는) 50MB를 초과합니다.`);
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

    // asDraft 플래그 그대로 따름 — 신규/편집 모두 동일하게 동작.
    //   '임시 저장' 버튼: status='draft'
    //   '제출' 버튼:      status='submitted'
    const willBeDraft = asDraft;

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
            : "임시 저장 중..."
          : "신청 제출 중...",
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
        ? await api.updateForm(editId, body)
        : await api.submitForm(body);

      // 파일은 신청 저장 후 순차 업로드 — 한 파일 실패해도 나머지 그대로 시도.
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

      // Next.js Router Cache 무효화 — '내 문서 목록' 같은 다른 페이지의 캐시된 상태를 다음 진입 시 다시 fetch 시킴.
      router.refresh();

      // 저장/제출 후 항상 신청 상세 페이지로 이동 — 페이지 본문의 '진행 상태' 카드에서
      // 방금 저장한 내역(상태 변화 + 진행 이력) 을 바로 확인 가능. chevron 자동 펼침은
      // 같은 내용 중복 노출이라 하지 않음.
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (isEdit) params.set("just-edited", "1");
      const qs = params.toString();
      router.push(`/governance/forms/detail/${result.id}${qs ? `?${qs}` : ""}`);
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
      {!embedded && (
        <Breadcrumb
          items={[
            { label: "Governance", href: "/governance" },
            from === "my"
              ? { label: "내 문서 목록", href: "/governance/forms/my" }
              : from === "admin"
              ? { label: "거버넌스 요청 관리", href: "/governance/admin/forms" }
              : { label: "데이터 거버넌스 문서 서식 모음", href: "/governance/forms" },
            { label: schema.label },
          ]}
        />
      )}

      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          {!embedded && (
            <h1 className="text-2xl font-bold tracking-tight">
              {schema.label}
              {isEdit && <span className="ml-2 text-base font-semibold text-gray-400">(수정)</span>}
            </h1>
          )}
        </div>

        {!embedded && (
          <FormProcessBar
            formType={formType}
            status={loadedStatus}
            history={loadedHistory}
            onSelectedStepChange={setSelectedStep}
          />
        )}
      </div>

      <form
        id="form-content"
        onSubmit={onSubmit}
        className={`space-y-8 ${hideForm ? "hidden" : ""}`}
      >
        {/* 요청자 정보 — SSO 로그인 정보로 자동 입력. 항상 노출, 흰 박스 + 0.5px 테두리 + dl 레이아웃. */}
        <section>
          <div className="mb-3 flex items-center gap-1.5">
            <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
            <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
              요청자 정보
            </h2>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-700 dark:bg-gray-900">
            <dl
              className="grid gap-y-2 gap-x-3.5 text-[12px]"
              style={{ gridTemplateColumns: "120px 1fr" }}
            >
              <dt className="text-gray-500 dark:text-gray-400">이름</dt>
              <dd className="text-gray-900 dark:text-gray-100">{submitterName || "-"}</dd>
              <dt className="text-gray-500 dark:text-gray-400">소속</dt>
              <dd className="text-gray-900 dark:text-gray-100">{submitterDepartment || "-"}</dd>
              <dt className="text-gray-500 dark:text-gray-400">이메일</dt>
              <dd className="text-gray-900 dark:text-gray-100">{submitterEmail || "-"}</dd>
            </dl>
          </div>
        </section>

        {schema.sections.map((section, sectionIdx) => {
          // 풀 와이드 단독 필드 (service_blocks) — 내부 표 래퍼 없이 렌더하되,
          // section.title 이 있으면 다른 섹션과 동일한 스타일의 헤더를 위에 노출.
          if (
            section.fields.length === 1 &&
            section.fields[0].type === "service_blocks"
          ) {
            const f = section.fields[0];
            return (
              <section key={`bare-${sectionIdx}`}>
                {section.title && (
                  <div className="mb-3 flex items-center gap-1.5">
                    <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
                    <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
                      {section.title}
                      {!section.optional && <span className="ml-1 text-brand">*</span>}
                    </h2>
                  </div>
                )}
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
              <div className="mb-3 flex items-center gap-1.5">
                <span className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
                <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
                  {section.title}
                  {!section.optional && <span className="ml-1 text-brand">*</span>}
                </h2>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.map(({ primary: f, inline }) => {
                      // 체크박스 / 결재선 칩 리스트 — 좌측 라벨 셀 생략 (헤더가 이미 의미 표현)
                      if (f.type === "checkbox" || f.type === "approver_list") {
                        return (
                          <tr key={f.key} className="border-b border-gray-100 last:border-b-0">
                            <td colSpan={2} className="px-5 py-3">
                              <FieldInput field={f} value={values[f.key]} onChange={(v) => setField(f.key, v)} allValues={values} />
                              <FieldHint field={f} currentValue={values[f.key]} />
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
                            <FieldHint field={f} currentValue={values[f.key]} />
                            {inline && <FieldHint field={inline} currentValue={values[inline.key]} />}
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
          <div className="mb-3 flex items-center gap-1.5">
            <span className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
            <h2 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
              파일 첨부
            </h2>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Upload size={12} /> 파일 선택
            </button>
            <span className="text-xs text-gray-500">샘플 데이터, 작업 가이드라인 등 · 최대 50MB</span>
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
            <ul className="space-y-2">
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

        {/* 하단 액션 — embedded(카탈로그 미리보기) 일 때는 숨김. */}
        {!embedded && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setCopyDone(false); setPreviewOpen(true); }}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Eye size={14} /> 미리보기
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              임시 저장
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
            >
              <Save size={14} /> {submitting ? "제출 중..." : "제출"}
            </button>
          </div>
        )}
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
                  비워둔 채로 저장하면 임시 저장 상태로 보관됩니다.
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

      {previewOpen && (() => {
        const allFields = schema.sections.flatMap((s) => s.fields);
        const data = {
          typeLabel: schema.label,
          projectName: derivePreviewProjectName(values[schema.projectField]),
          submitterName,
          submitterDepartment,
          submitterEmail,
          payload: values,
          fields: allFields,
        };
        return (
          <FormPreviewModal
            data={data}
            copyDone={copyDone}
            onCopy={async () => {
              try {
                await copyPreviewToClipboard(data);
                setCopyDone(true);
                setTimeout(() => setCopyDone(false), 2000);
              } catch (e) {
                setError("클립보드 복사 실패: " + (e as Error).message);
              }
            }}
            onClose={() => setPreviewOpen(false)}
          />
        );
      })()}

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
        <NumberInput
          value={(value as string) ?? ""}
          onChange={(_n, raw) => onChange(raw)}
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
    case "approver_list":
      return (
        <ApproverListField
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(v)}
          placeholder={field.placeholder}
        />
      );
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
function FieldHint({ field, currentValue }: { field: FieldDef; currentValue?: unknown }) {
  if (!field.hint && !field.hintLink) return null;

  // hintWhen 이 지정되어 있으면 현재 값이 매칭될 때만 노출
  if (field.hintWhen !== undefined) {
    const allowed = Array.isArray(field.hintWhen) ? field.hintWhen : [field.hintWhen];
    if (typeof currentValue !== "string" || !allowed.includes(currentValue)) {
      return null;
    }
  }

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
 * 결제 통화 — USD / KRW. (그 외 옵션 제거됨.)
 */
function CurrencyField({
  value,
  onChange,
}: {
  value: { kind?: string; custom?: string };
  onChange: (next: { kind?: string; custom?: string }) => void;
}) {
  const kind = value.kind ?? "";

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
    </div>
  );
}

/**
 * 업무생산성 도구 신청 — 서비스 블록 동적 리스트.
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

  // 통화별 합산 — API 활용 계획서와 동일한 형식.
  const totals = list.reduce<Record<string, number>>((acc, b) => {
    const code =
      b.currency?.kind === "기타"
        ? (b.currency.custom?.trim() || "OTHER")
        : (b.currency?.kind ?? "");
    if (!code) return acc;
    const m = b.cost ? b.cost.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/) : null;
    const amount = m ? Number(m[0]) : 0;
    if (!Number.isFinite(amount) || amount <= 0) return acc;
    acc[code] = (acc[code] ?? 0) + amount * b.members.length;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {list.map((block, idx) => (
        <ServiceBlockCard
          key={idx}
          index={idx}
          block={block}
          onChange={(patch) => update(idx, patch)}
          onRemove={() => remove(idx)}
        />
      ))}

      {/* 서비스 추가 버튼 — API 활용 계획서와 동일한 outline 스타일. */}
      <button
        type="button"
        onClick={add}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-5 py-2.5 text-[13px] font-medium text-blue-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-blue-300"
      >
        + 서비스 추가
      </button>

      {/* 총 예상 비용 — 모든 서비스의 (예상 비용 × 인원 수) 합산, 통화별 분리. */}
      <div className="flex items-center justify-between rounded-md bg-blue-50 px-4 py-3.5 dark:bg-blue-950/40">
        <div>
          <div className="text-[13px] font-medium text-blue-700 dark:text-blue-300">
            총 예상 비용
          </div>
          <div className="mt-0.5 text-[11px] text-blue-700/70 dark:text-blue-300/70">
            서비스별 (예상 비용 × 인원 수) 자동 합계
          </div>
        </div>
        <span className="text-[18px] font-semibold text-blue-700 dark:text-blue-300">
          {formatTotals(totals)}
        </span>
      </div>
    </div>
  );
}

function formatTotals(totals: Record<string, number>): string {
  const entries = Object.entries(totals).filter(([, n]) => n > 0);
  if (entries.length === 0) return "—";
  return entries
    .map(([code, n]) => {
      const formatted = n.toLocaleString("ko-KR");
      const prefix =
        code === "USD" ? "$" : code === "KRW" ? "₩" : code === "EUR" ? "€" : code === "JPY" ? "¥" : "";
      return prefix ? `${prefix}${formatted}` : `${formatted} ${code}`;
    })
    .join(" · ");
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
    <div className="rounded-lg bg-gray-50 px-4 py-3.5 dark:bg-gray-800/40">
      {/* 서비스 카드 헤더 — API 활용 요청서와 동일한 빨간 막대 + 라벨 + X 버튼 */}
      <header className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            서비스 {index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="서비스 삭제"
          className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </header>

      {/* grid 레이아웃 — API 활용 요청서와 동일 (100px 라벨 + 입력) */}
      <div
        className="grid items-start gap-x-3.5 gap-y-2.5 text-[12px]"
        style={{ gridTemplateColumns: "100px 1fr" }}
      >
        <label className="pt-2 text-gray-500 dark:text-gray-400">서비스명</label>
        <input
          type="text"
          value={block.service_name}
          onChange={(e) => onChange({ service_name: e.target.value })}
          placeholder="예: Claude API"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />

        <label className="pt-2 text-gray-500 dark:text-gray-400">활용 방안</label>
        <textarea
          rows={2}
          value={block.usage}
          onChange={(e) => onChange({ usage: e.target.value })}
          placeholder="예: 내부 데이터 분석 자동화 및 AI 리포트 생성"
          className="resize-y rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] focus:border-brand focus:outline-none dark:border-gray-700 dark:bg-gray-900"
        />

        <label className="pt-2 text-gray-500 dark:text-gray-400">결제 통화</label>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pt-1.5">
          <CurrencyField
            value={block.currency}
            onChange={(c) => onChange({ currency: c })}
          />
        </div>

        <label className="pt-2 text-gray-500 dark:text-gray-400">예상 비용</label>
        <AmountWithCurrencyInput
          value={block.cost}
          onChange={(v) => onChange({ cost: v })}
          placeholder="예: 5,000"
          currency={block.currency}
        />

        <label className="pt-2 text-gray-500 dark:text-gray-400">결제 방식</label>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 pt-1.5">
          {["월 구독", "연 구독", "구매"].map((opt) => (
            <label key={opt} className="inline-flex cursor-pointer items-center gap-1.5 text-[12px]">
              <input
                type="radio"
                name={`payment-${index}`}
                value={opt}
                checked={block.payment_method === opt}
                onChange={() => onChange({ payment_method: opt })}
                className="h-3.5 w-3.5 text-brand focus:ring-brand"
              />
              {opt}
            </label>
          ))}
        </div>

        <label className="pt-2 text-gray-500 dark:text-gray-400">사용자</label>
        <MemberChipsField
          members={block.members}
          onChange={(members) => onChange({ members })}
        />

        <label className="pt-2 text-gray-500 dark:text-gray-400">인원 수</label>
        <div className="flex items-center gap-2 pt-2 text-[12px]">
          <span className="font-medium text-gray-900 dark:text-gray-100">{memberCount}</span>
          <span className="text-gray-500">명</span>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            사용자 수 자동 계산
          </span>
        </div>

        <label className="pt-2 text-gray-500 dark:text-gray-400">총 비용</label>
        <div className="flex items-center gap-2 pt-2 text-[12px]">
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {totalCost ?? <span className="text-gray-300">—</span>}
          </span>
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            예상 비용 × 인원 수
          </span>
        </div>
      </div>
    </div>
  );
}

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

/**
 * 결재선 입력 — 이름을 한 명씩 Enter 로 추가하는 칩 리스트.
 *
 * 칩에는 이니셜 아바타(영문 두 단어면 각 첫 글자, 그 외에는 앞 1~2자)와
 * 이름이 함께 표시되고, X 아이콘으로 제거. 빈 입력으로 Enter 시 무시,
 * 중복 이름은 추가하지 않음.
 */
function ApproverListField({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  }

  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {value.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2 text-sm text-gray-700"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
            {approverInitials(name)}
          </span>
          <span>{name}</span>
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`${name} 제거`}
            className="grid h-4 w-4 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing || e.key === "Process") return;
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder ?? "이름 입력 후 Enter"}
        className="min-w-[180px] flex-1 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm placeholder:text-gray-400 focus:border-brand focus:outline-none"
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
  type = "text",
}: {
  label: string;
  value: string;
  // SSO 로그인으로 자동 입력되는 값 — onChange/placeholder 제거, readOnly 표시.
  type?: "text" | "email";
}) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="w-56 bg-gray-50/50 px-5 py-3 align-top text-gray-700">{label}</td>
      <td className="px-5 py-3">
        <input
          type={type}
          value={value}
          readOnly
          tabIndex={-1}
          aria-readonly="true"
          title="SSO 로그인 정보로 자동 입력됩니다"
          className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500 focus:outline-none"
        />
      </td>
    </tr>
  );
}
