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
import { api, type ApprovalEntry, type FormStatus } from "@/lib/api";
import { FORM_SCHEMAS } from "@/lib/formSchemas";
import { ApplicationTypeChip } from "./ApplicationTypeChip";
import { ApplicationFormSection } from "./ApplicationFormSection";
import { ApplicationPreviewModal } from "./ApplicationPreviewModal";
import { StatusBanner } from "./StatusBanner";
import { ProgressStatusBlock } from "./ProgressStatusBlock";
import { ProgressHistoryBlock } from "./ProgressHistoryBlock";
import { SubmittedSummaryBlock } from "./SubmittedSummaryBlock";
import {
  APPLICATION_TO_FORM_TYPE,
  mockHistoryFor,
  type ApplicationStatus,
  type ApplicationType,
  type HistoryAction,
  type StatusHistoryItem,
} from "@/lib/applicationFormConfig";

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
      return {
        id: `srv-${i}-${e.changed_at}`,
        action,
        actor: e.changed_by,
        actorRole: "신청자",
        timestamp: isoToShort(e.changed_at),
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
  // 추적 모드(submitted+) 에서 '← 신청서 화면' 클릭 시 양식을 읽기 전용으로 다시 노출.
  const [showFormView, setShowFormView] = useState(false);
  // 백엔드에 저장된 신청 id — 첫 저장 후 채워짐. 이후 임시 저장·제출은 PATCH 로 같은 row 갱신.
  const [formId, setFormId] = useState<number | null>(null);
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

  /** 임시 저장 / 제출 공용 — 첫 호출은 POST(submitForm), 이후는 PATCH(updateForm). */
  async function persist(asDraft: boolean): Promise<boolean> {
    if (submitting) return false;
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
      // 다른 페이지(거버넌스 요청 목록 / 신청 처리 큐) 가 다음 진입 시 새 데이터를 가져오도록 캐시 무효화.
      router.refresh();
      return true;
    } catch (e) {
      const msg = (e as Error).message || "저장에 실패했습니다.";
      console.error("[form] persist failed", e);
      window.alert(`저장에 실패했습니다.\n${msg}`);
      return false;
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
    if (ok) showToast("임시 저장되었습니다");
  };
  // 신청서 제출 클릭 → 즉시 제출이 아니라 미리보기 모달을 먼저 띄움.
  const onOpenPreview = () => setPreviewOpen(true);
  // 미리보기 모달 안의 '제출' 버튼 클릭 시 실제 백엔드 제출 + 상태 전이.
  const onConfirmSubmit = async () => {
    const ok = await persist(false);
    if (!ok) return;
    setPreviewOpen(false);
    setStatus("submitted");
  };

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
      </header>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {readOnly
          ? "제출된 신청서 내용을 확인할 수 있습니다."
          : "계획 수립 단계에서 정리한 내용을 입력하세요."}
      </p>

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
          />
        ))}
      </form>
    </section>
  );

  if (status === "draft") {
    return (
      <>
        <StatusBanner status={status} />
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
          <ApplicationPreviewModal
            type={type}
            onClose={() => setPreviewOpen(false)}
            onConfirmSubmit={onConfirmSubmit}
          />
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

        {renderFormCard(true)}
      </div>
    );
  }

  // tracking mode (submitted / reviewing / approved)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-1">
        <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100">
          {PAGE_TITLE[type]}
        </h2>
        <ApplicationTypeChip type={type} />
      </div>

      <ProgressStatusBlock status={status} history={history} />
      <ProgressHistoryBlock history={history} />
      <SubmittedSummaryBlock type={type} />

      <TrackingActions
        onShowForm={() => setShowFormView(true)}
        onProceedToApproval={onProceedToApproval}
      />
    </div>
  );
}

// --- 신청자 정보 (읽기 전용, 토글 가능) ---

function SubmitterReadOnlySection({
  applicant,
}: {
  applicant: { name: string; department: string; email: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-4 inline-flex items-center gap-2 text-left"
      >
        <span aria-hidden="true" className="block h-4 w-[3px] rounded-sm bg-brand" />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          신청자 정보
        </h3>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
        />
      </button>

      {open && (
        <div className="space-y-3.5">
          <ReadOnlyRow label="신청자 이름" value={applicant.name} />
          <ReadOnlyRow label="소속" value={applicant.department} />
          <ReadOnlyRow label="이메일" value={applicant.email} />
        </div>
      )}
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[140px_1fr] sm:gap-3">
      <span className="pt-1.5 text-[13px] text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <input
        type="text"
        value={value}
        readOnly
        disabled
        className="w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
      />
    </div>
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
  onProceedToApproval,
}: {
  onShowForm: () => void;
  onProceedToApproval: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onShowForm}
        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        신청서 화면
      </button>
      <button
        type="button"
        onClick={onProceedToApproval}
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
