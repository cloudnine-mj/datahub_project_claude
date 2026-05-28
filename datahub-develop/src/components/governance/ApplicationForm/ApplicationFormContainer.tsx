// 신청서 작성 substep 메인 컨테이너 — status 에 따라 작성/추적 두 모드로 분기.
//   - 디자인은 커스텀 (빨간 막대 섹션 + 120px 라벨 + 유형 칩 + custom 액션 영역)
//   - 양식 필드는 FORM_SCHEMAS 를 단일 진실의 원천으로 사용 (이전 임의 config 폐기)
//   - draft: 안내 배너 + 양식 카드(신청자 정보 + 스키마 섹션들) + 작성 액션
//   - submitted/reviewing/approved: 큰 제목 + 진행 상태/이력 + 요약 + 추적 액션

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, FileText, Save } from "lucide-react";
import { api, type ApprovalEntry, type FormStatus } from "@/lib/governance/api-client-full";
import { FORM_SCHEMAS } from "@/lib/governance/forms/schemas";
import { ApplicationTypeChip } from "./ApplicationTypeChip";
import { ApplicationFormSection } from "./ApplicationFormSection";
import { PreSubmitPreviewModal } from "./PreSubmitPreviewModal";
import { ServiceExampleModal } from "./ServiceExampleModal";
import { StatusBanner } from "./StatusBanner";
import {
  APPLICATION_TO_FORM_TYPE,
  mockHistoryFor,
  type ApplicationStatus,
  type ApplicationType,
  type HistoryAction,
  type StatusHistoryItem,
} from "@/lib/governance/forms/application-config";

/** 'M/d HH:mm' 형식의 현재 시각 — history 항목 timestamp 용. */
function nowShort(): string {
  const d = new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

/** ISO timestamp → 'M/d HH:mm'. 잘못된 입력은 그대로 반환. */
function isoToShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusToAction(status: FormStatus): HistoryAction | null {
  if (status === "draft") return "임시 저장";
  if (status === "submitted") return "제출됨";
  if (status === "reviewing") return "검토 시작";
  if (status === "approved") return "승인 완료";
  return null;
}

function buildHistoryFromBackend(entries: ApprovalEntry[]): StatusHistoryItem[] {
  return entries
    .map((e, i): StatusHistoryItem | null => {
      const action = statusToAction(e.status);
      if (!action) return null;
      const at = e.changedAt ?? e.changed_at ?? "";
      const by = e.changedBy ?? e.changed_by ?? "";
      return {
        id: `srv-${i}-${at}`,
        action,
        actor: by,
        actorRole: "신청자",
        timestamp: isoToShort(at),
        comment: e.comment ?? undefined,
      };
    })
    .filter((x): x is StatusHistoryItem => !!x);
}

/** ApplicationType 별 sessionStorage 키 — 사용자가 같은 type 페이지로 돌아오면 마지막 신청 id 복원. */
const STORAGE_KEY = (t: ApplicationType) => `datahub:lastFormId:${t}`;

function isAppStatus(s: string): s is ApplicationStatus {
  return s === "draft" || s === "submitted" || s === "reviewing" || s === "approved";
}

interface Props {
  type: ApplicationType;
  initialStatus: ApplicationStatus;
  /** 작성 모드 '계획 수립 다시 보기' 버튼 경로. */
  prevPath?: string;
  /** 다음 substep (전자결재 품의) 경로. */
  nextPath: string;
}

const PAGE_TITLE: Record<ApplicationType, string> = {
  service: "데이터 용역 제작 신청",
  purchase: "데이터 구매 신청",
  subscribe: "데이터 구독 신청",
};

const FALLBACK_APPLICANT_INFO = {
  name: "김데이터",
  department: "AI Platform",
  email: "kim.data@lgresearch.ai",
};

export function ApplicationFormContainer({
  type,
  initialStatus,
  prevPath,
  nextPath,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ApplicationStatus>(initialStatus);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  // 용역 제작 신청서 [작성 예시] 모달 — 임시 저장 왼쪽 버튼 클릭으로 토글.
  const [exampleOpen, setExampleOpen] = useState(false);
  // 추적 모드 '전자결재 품의' 버튼 → 전자결재 substep(/forms/approval) 로 이동.
  //   결재 본문 미리보기·표 형태 복사는 해당 페이지가 직접 제공.
  // 추적 모드(submitted+) 에서 '← 신청서 화면' 클릭 시 양식을 읽기 전용으로 다시 노출.
  const [showFormView, setShowFormView] = useState(false);
  // 백엔드에 저장된 신청 id — 첫 저장 후 채워짐. 이후 임시 저장·제출은 PATCH 로 같은 row 갱신.
  // cuid 문자열 id — 백엔드 GovernanceForm.id 와 매칭.
  const [formId, setFormId] = useState<string | null>(null);
  const [applicant, setApplicant] = useState(FALLBACK_APPLICANT_INFO);
  const [submitting, setSubmitting] = useState(false);
  // 임시 저장 등 단발성 알림 — 일정 시간 후 자동 사라짐.
  const [toast, setToast] = useState<string | null>(null);
  // 진행 이력 — URL 로 직접 status 를 받은 데모 모드면 mock 으로 채우고, 사용자 실제 액션은 실시간 timestamp 로 누적.
  const [history, setHistory] = useState<StatusHistoryItem[]>(() =>
    mockHistoryFor(initialStatus),
  );

  // 로그인 사용자 정보 — 백엔드 신청에 첨부될 submitter 필드용.
  useEffect(() => {
    api
      .me()
      .then((m) => {
        setApplicant({
          name: m.user.name ?? FALLBACK_APPLICANT_INFO.name,
          department: m.user.department ?? FALLBACK_APPLICANT_INFO.department,
          email: m.user.email ?? FALLBACK_APPLICANT_INFO.email,
        });
      })
      .catch(() => {
        /* 비로그인 / 미연결 — fallback 값 그대로 사용. */
      });
  }, []);

  // 신청자 화면은 draft(작성 중) 만 노출. 이미 제출된 상태(submitted / reviewing /
  // approved) 로 직접 진입한 경우는 진행 상태 추적 화면을 보여주지 않고
  // 거버넌스 요청 목록으로 보냄 — 사내 정책 변경.
  useEffect(() => {
    if (status !== "draft") {
      router.replace("/governance/forms/list");
    }
  }, [status, router]);

  // 사용자가 같은 유형 신청서로 돌아왔을 때, 직전에 저장/제출한 form 을 복원.
  //   - sessionStorage 에서 마지막 id 조회
  //   - api.getForm 으로 백엔드에서 payload/status/approval_history 가져와 state 복원
  //   - 실패 시 sessionStorage 정리하고 기본 동작
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedIdStr = sessionStorage.getItem(STORAGE_KEY(type));
    if (!savedIdStr) return;
    const savedId = Number(savedIdStr);
    if (!Number.isFinite(savedId)) {
      sessionStorage.removeItem(STORAGE_KEY(type));
      return;
    }
    api
      .getForm(savedId)
      .then((f) => {
        // 다른 유형의 form 이 잘못 저장된 경우 무시
        if (f.form_type !== APPLICATION_TO_FORM_TYPE[type]) return;
        setFormId(f.id);
        setValues((f.payload ?? {}) as Record<string, unknown>);
        if (isAppStatus(f.status)) {
          setStatus(f.status);
        }
        if (f.approval_history && f.approval_history.length > 0) {
          setHistory(buildHistoryFromBackend(f.approval_history));
        }
      })
      .catch(() => {
        sessionStorage.removeItem(STORAGE_KEY(type));
      });
  }, [type]);

  const formType = APPLICATION_TO_FORM_TYPE[type];
  const schema = FORM_SCHEMAS[formType];

  /** 동일 action 은 최신값으로 갱신 (예: 임시 저장 여러 번 → 마지막 한 줄만 노출). */
  function upsertHistory(action: HistoryAction) {
    setHistory((prev) => [
      ...prev.filter((h) => h.action !== action),
      {
        id: `${action}-${Date.now()}`,
        action,
        actor: applicant.name,
        actorRole: "신청자",
        timestamp: nowShort(),
      },
    ]);
  }

  const onChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  /** projectName 추출 — FORM_SCHEMAS 의 projectField 가 가리키는 값. 비어있으면 '(미입력)'. */
  function deriveProjectName(): string {
    const raw = values[schema.projectField];
    if (typeof raw === "string" && raw.trim()) return raw.trim();
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
      const first = raw[0] as Record<string, unknown>;
      const name = first.service_name;
      if (typeof name === "string" && name.trim()) return name.trim();
    }
    if (raw != null) return String(raw);
    return "(미입력)";
  }

  /** 임시 저장 / 제출 공용 — 첫 호출은 POST(submitForm), 이후는 PATCH(updateForm).
   *  반환값: 성공 시 form id, 실패 시 null. (이전 boolean → id 로 확장 — 채팅 자동 draft
   *  생성에서 새 id 가 필요해서 변경. 호출부는 `!!await persist(...)` 로 truthy 체크.) */
  async function persist(asDraft: boolean): Promise<string | null> {
    if (submitting) return null;
    setSubmitting(true);
    try {
      const body = {
        form_type: formType,
        project_name: deriveProjectName(),
        payload: values,
        status: asDraft ? "draft" : "submitted",
        submitter_name: applicant.name || undefined,
        submitter_email: applicant.email || undefined,
        submitter_department: applicant.department || undefined,
      };
      const result = formId
        ? await api.updateForm(formId, body)
        : await api.submitForm(body);
      setFormId(result.id);
      // 같은 유형으로 다시 들어왔을 때 복원할 수 있도록 sessionStorage 에 기록.
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY(type), String(result.id));
      }
      // 진행 이력에 현재 시각으로 항목 추가/갱신 (mock 날짜 대신).
      upsertHistory(asDraft ? "임시 저장" : "제출됨");
      // 다른 페이지(거버넌스 요청 목록 / 거버넌스 요청 관리) 가 다음 진입 시 새 데이터를 가져오도록 캐시 무효화.
      router.refresh();
      return result.id;
    } catch (e) {
      const msg = (e as Error).message || "저장에 실패했습니다.";
      console.error("[form] persist failed", e);
      window.alert(`저장에 실패했습니다.\n${msg}`);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2000);
  };

  const onSaveDraft = async () => {
    const ok = await persist(true);
    if (ok) {
      showToast("임시 저장되었습니다");
      // 추적 모드에서 '신청서 화면' 으로 들어와 임시 저장한 경우, 상태도 draft 로 내려와야 UI 가 일관됨.
      setStatus("draft");
      setShowFormView(false);
    }
  };
  // 신청서 제출 클릭 → 즉시 제출이 아니라 미리보기 모달을 먼저 띄움.
  const onOpenPreview = () => setPreviewOpen(true);
  // 미리보기 모달 안의 '제출' 버튼 클릭 시 실제 백엔드 제출 + 거버넌스 요청 목록으로 이동.
  // 사내 정책 변경으로 제출 후 진행 상태 추적 화면(ProgressStatusBlock + SubmittedSummaryBlock)
  // 은 노출하지 않음 — 신청자는 거버넌스 요청 목록에서 상태만 확인.
  // ?submitted=1 query 로 목록 페이지가 토스트를 한 번 더 띄울 수 있도록 신호 전달.
  const onConfirmSubmit = async () => {
    const ok = await persist(false);
    if (!ok) return;
    setPreviewOpen(false);
    router.push("/governance/forms/list?submitted=1");
  };

  // '전자결재 품의 →' 버튼 — substep 3 (전자결재 품의 페이지) 로 이동.
  const onProceedToApproval = () => router.push(nextPath);


  // 작성 모드 양식 카드 — draft 또는 추적 모드에서 '신청서 화면' 토글 시 노출.
  const renderFormCard = (readOnly: boolean) => (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900 sm:px-6 sm:py-5">
      <header className="flex items-center gap-2">
        <FileText
          size={16}
          aria-hidden="true"
          className="text-gray-500 dark:text-gray-400"
        />
        <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
          신청서 작성
        </h2>
        <ApplicationTypeChip type={type} />
        {/* 작성 예시 — 용역 제작 한정. 헤더 우측 끝에 정렬(ml-auto). draft 모드에서만 노출. */}
        {!readOnly && type === "service" && (
          <button
            type="button"
            onClick={() => setExampleOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FileText size={13} aria-hidden="true" /> 작성 예시
          </button>
        )}
      </header>
      {readOnly && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          제출된 신청서 내용을 확인할 수 있습니다.
        </p>
      )}

      <form
        className="mt-5 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!readOnly) onOpenPreview();
        }}
      >
        <SubmitterReadOnlySection applicant={applicant} />
        {schema.sections.map((s, i) => (
          <ApplicationFormSection
            key={`${s.title}-${i}`}
            section={s}
            values={values}
            onChange={onChange}
            disabled={readOnly}
            formId={formId}
            applicationType={type}
          />
        ))}
      </form>
    </section>
  );

  if (status === "draft") {
    return (
      <>
        <StatusBanner status={status} />

        {/* 작성 모드 — 신청서 단일 칸. (이전엔 우측 담당자 채팅 패널이 있었으나
            신청서 단계에서는 사용자 요청으로 제거. 5단계 상세 페이지의 ChatPanel
            은 유지.) */}
        <div>
          {renderFormCard(false)}

          <DraftActions
            prevPath={prevPath}
            onSaveDraft={onSaveDraft}
            onSubmit={onOpenPreview}
          />
        </div>

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
          >
            {toast}
          </div>
        )}

        {previewOpen && (
          <PreSubmitPreviewModal
            type={type}
            payload={values}
            applicantName={applicant.name}
            applicantDepartment={applicant.department}
            onClose={() => setPreviewOpen(false)}
            onConfirmSubmit={onConfirmSubmit}
          />
        )}

        {/* 작성 예시 모달 — 용역 제작 한정. */}
        {exampleOpen && type === "service" && (
          <ServiceExampleModal onClose={() => setExampleOpen(false)} />
        )}
      </>
    );
  }

  // 추적 모드에서 '← 신청서 화면' 클릭한 상태 — 양식을 읽기 전용으로 노출.
  if (showFormView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100">
            {PAGE_TITLE[type]}
          </h2>
          <ApplicationTypeChip type={type} />
        </div>

        {/* 추적 모드에서 들어왔지만 편집 가능 — 임시 저장 / 신청서 제출 동일 동작. */}
        {renderFormCard(false)}

        <DraftActions
          prevPath={prevPath}
          onSaveDraft={onSaveDraft}
          onSubmit={onOpenPreview}
        />

        {toast && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
          >
            {toast}
          </div>
        )}

        {previewOpen && (
          <PreSubmitPreviewModal
            type={type}
            payload={values}
            applicantName={applicant.name}
            applicantDepartment={applicant.department}
            onClose={() => setPreviewOpen(false)}
            onConfirmSubmit={onConfirmSubmit}
          />
        )}
      </div>
    );
  }

  // tracking mode (submitted / reviewing / approved) — 사내 정책상 노출 안 함.
  // useEffect 가 router.replace 로 my 목록으로 보내므로 본 분기는 한 프레임만 살아있음.
  // 안전을 위해 null 로 즉시 반환 (혹시 redirect 가 늦으면 빈 화면).
  return null;
}

// --- 신청자 정보 (읽기 전용) ---
// 빨간 막대 + '신청자 정보' 헤더 + 표 (라벨 240px 회색 / 값 1fr 흰색, 행 사이 구분선).
// 양식의 다른 섹션(조직장 사전 승인 / 요청 정보) 의 표 레이아웃과 시각 통일.

function SubmitterReadOnlySection({
  applicant,
}: {
  applicant: { name: string; department: string; email: string };
}) {
  const rows: { label: string; value: string }[] = [
    { label: "이름", value: applicant.name },
    { label: "소속", value: applicant.department },
    { label: "이메일", value: applicant.email },
  ];
  return (
    <section>
      <div className="mb-3 flex items-center gap-1.5">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          신청자 정보
        </h3>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        {rows.map((r, i) => {
          const isLast = i === rows.length - 1;
          return (
            <div
              key={r.label}
              className={`grid grid-cols-[240px_1fr] ${
                isLast ? "" : "border-b border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="flex items-center bg-gray-50 px-4 py-4 text-[12px] text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
                {r.label}
              </div>
              <div className="flex items-center px-4 py-4 text-[12px] text-gray-900 dark:text-gray-100">
                {r.value}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- 액션 영역 ---

interface DraftActionsProps {
  prevPath?: string;
  onSaveDraft: () => void;
  /** 신청서 제출 버튼 클릭 핸들러 — 미리보기 모달을 먼저 열고 그 안에서 실제 제출 확정. */
  onSubmit: () => void;
}

function DraftActions({
  prevPath,
  onSaveDraft,
  onSubmit,
}: DraftActionsProps) {
  return (
    <div className="mt-2 flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center">
      <div>
        {prevPath && (
          <Link
            href={prevPath}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            계획 수립 다시 보기
          </Link>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton onClick={onSaveDraft} icon={Save} label="임시 저장" />
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
        >
          신청서 제출
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function TrackingActions({
  onShowForm,
  onShowApprovalCopy,
}: {
  onShowForm: () => void;
  onShowApprovalCopy: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onShowForm}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        수정
      </button>
      <button
        type="button"
        onClick={onShowApprovalCopy}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-dark"
      >
        전자결재 품의
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

function SecondaryButton({
  onClick,
  icon: Icon,
  label,
}: {
  onClick: () => void;
  icon: typeof Save;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      <Icon size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
