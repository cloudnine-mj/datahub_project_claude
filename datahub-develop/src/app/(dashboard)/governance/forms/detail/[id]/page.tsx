// 화면 9: 데이터 구매 신청 (read-only 상세). 모든 신청 종류 공통 사용.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, CheckSquare, Database, Eye, Pencil, Send, Square, X } from "lucide-react";
import { api, type FormDetail, type Me } from "@/lib/governance/api-client-full";
import { Breadcrumb } from "@/components/governance/Breadcrumb";
import { DeleteFormButton } from "@/components/governance/DeleteFormButton";
import { FormStatusPanel } from "@/components/governance/FormStatusPanel";
import { FormProcessBar } from "@/components/governance/FormProcessBar";
import { FORM_TYPE_LABELS } from "@/lib/governance/forms/utils-bridge";
import { FORM_SCHEMAS, type FieldDef } from "@/lib/governance/forms/schemas";
import { FORM_TYPE_TO_APPLICATION } from "@/lib/governance/forms/application-config";
import { approverInitials } from "@/lib/governance/forms/utils-bridge";
import { FormPreviewModal } from "@/components/governance/FormPreviewModal";
import { copyPreviewToClipboard, type PreviewData } from "@/lib/governance/forms/preview";
import { findFirstEmptyRequired } from "@/lib/governance/forms/validation";
import { ProgressHistoryBlock } from "@/components/governance/forms/progress-history-block";
import { getChatRole } from "@/lib/governance/forms/get-chat-role";
import { approvalHistoryToStatusItems } from "@/lib/governance/forms/history-adapter";
import {
  ProgressBar,
  SERVICE_STAGES,
  readServiceStage,
  writeServiceStage,
  readSubStep,
  writeSubStep,
  type SubStep,
} from "@/components/governance/ProgressBar";
import { ApplicationStageTab } from "@/components/governance/stages/ApplicationStageTab";
import { ChatPanel } from "@/components/governance/chat/ChatPanel";
import { getChatAssignee } from "@/lib/governance/chat-assignee";
import {
  HistoryTimeline,
  approvalHistoryToEvents,
} from "@/components/governance/HistoryTimeline";
import { AttachmentSection } from "@/components/governance/AttachmentSection";

/** 신청서 편집 진입 URL.
 *  작성 흐름(ApplicationFormContainer)이 지원하는 유형이면 작성 화면과 동일한 intake 폼을
 *  기존 신청서 id 로 프리필해서 열고, 그 외 유형은 기존 FormBuilder 편집 모드를 유지한다. */
function buildEditHref(form: FormDetail, from: string | null): string {
  const appType = FORM_TYPE_TO_APPLICATION[form.form_type];
  if (appType) {
    return `/governance/forms/intake?type=${appType}&id=${form.id}`;
  }
  return `/governance/forms/${form.form_type}/new?id=${form.id}${from ? `&from=${from}` : ""}`;
}

export default function Page({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justEdited = searchParams?.get("just-edited") === "1";
  // 진입 출처 — 브레드크럼 부모를 어디로 표시할지 결정.
  //   from=my    → '내 문서 목록'
  //   from=admin → '거버넌스 요청 관리'
  //   기본        → '데이터 거버넌스 문서 서식 모음' (서식 선택 화면에서 들어온 경우)
  const from = searchParams?.get("from");
  const [form, setForm] = useState<FormDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // 진행 바에서 선택된 단계 — '신청서 작성'(1) / '신청서 진행 상황'(2) 일 때는
  // 신청서 데이터 표를 함께 노출 (작성된 내용 또는 진행 중인 내용 확인용).
  // 사전·후속 단계(0 필요성 정의 / 3 전자결재 진행) 에서는 단계별 정보만 보이도록
  // 데이터 표 숨김.
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const hideForm = selectedStep === 0 || selectedStep === 3;
  const [missingField, setMissingField] = useState<string | null>(null);
  // 미리보기 모달 — 전자결재 에디터에 붙여넣을 HTML 표를 생성해 보여줌
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  // 코멘트 카드(ProgressHistoryBlock) refetch 트리거 — 상태 변경 시 등 외부 액션이
  // 메시지를 생성한 후 이 값을 bump 하면 코멘트 카드가 messages 를 다시 조회한다.
  const [messageRefreshNonce, setMessageRefreshNonce] = useState(0);
  // Phase 1 — 용역 제작 5단계 진행 상태(sessionStorage 기반 mock).
  // 신청 단계(0) 에서 시작 → 총괄이 실무자 지정 후 [협의 단계로] 버튼 클릭으로 1 로 전환.
  // approved 면 4(종료) 로 강제.
  const [serviceStage, setServiceStage] = useState<number>(0);
  // 신청 단계 내부 sub-step (lift) — ProgressBar / ApplicationStageTab 둘 다 공유.
  const [subStep, setSubStepState] = useState<SubStep>("member_assignment");

  const refetch = useCallback(() => {
    api.getForm(params.id).then(setForm).catch((e) => setError((e as Error).message));
    setMessageRefreshNonce((n) => n + 1);
  }, [params.id]);

  async function submitDraft() {
    if (!form) return;
    setError(null);

    // 정식 제출 검증 — FormBuilder 와 동일 규칙 (필수 섹션 / 비-checkbox 필드)
    const schema = FORM_SCHEMAS[form.form_type];
    const missing = findFirstEmptyRequired(schema, form.payload, {
      submitterName: form.submitter_name || "",
      submitterDepartment: form.submitter_department || "",
      submitterEmail: form.submitter_email || "",
    });
    if (missing) {
      setMissingField(missing);
      return;
    }

    setSubmitting(true);
    try {
      await api.updateForm(form.id, {
        form_type: form.form_type,
        project_name: form.project_name,
        payload: form.payload,
        status: "submitted",
        submitter_name: form.submitter_name,
        submitter_email: form.submitter_email,
        submitter_department: form.submitter_department ?? undefined,
      });
      // 내 문서 목록 등 다른 페이지의 Router Cache 무효화
      router.refresh();
      router.push(`/governance/forms/submitted?id=${form.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  useEffect(() => {
    refetch();
    api.me().then(setMe).catch(() => setMe(null));
  }, [refetch]);

  // 폼 로드 후 sessionStorage 의 5단계 / sub-step 동기화.
  useEffect(() => {
    if (!form) return;
    setServiceStage(readServiceStage(form.id, form.status));
    setSubStepState(readSubStep(form.id));
  }, [form]);

  const advanceServiceStage = useCallback(() => {
    if (!form) return;
    const next = Math.min(4, serviceStage + 1);
    setServiceStage(next);
    writeServiceStage(form.id, next);
  }, [form, serviceStage]);

  // Phase 1 — 개발 편의를 위해 chevron 탭 클릭 시 자유 이동. 권한 가드 없음.
  const jumpServiceStage = useCallback(
    (idx: number) => {
      if (!form) return;
      const clamped = Math.max(0, Math.min(4, idx));
      setServiceStage(clamped);
      writeServiceStage(form.id, clamped);
    },
    [form],
  );

  const setSubStep = useCallback(
    (next: SubStep) => {
      if (!form) return;
      setSubStepState(next);
      writeSubStep(form.id, next);
    },
    [form],
  );

  if (error) return <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!form) return <div className="text-sm text-gray-400">불러오는 중...</div>;

  const schema = FORM_SCHEMAS[form.form_type];
  const label = FORM_TYPE_LABELS[form.form_type];
  const allFields = schema.sections.flatMap((s) => s.fields);
  // 스키마에 첨부파일 필드가 있으면 신청 정보 표의 행으로 인라인 노출(아래 별도 섹션 생략).
  // 없는 유형은 기존처럼 표 아래 별도 첨부파일 섹션을 노출.
  const hasInlineAttachment = allFields.some((f) => f.type === "attachment");

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "Governance", href: "/governance" },
            from === "my"
              ? { label: "내 문서 목록", href: "/governance/forms/my" }
              : from === "admin"
              ? { label: "거버넌스 요청 관리", href: "/governance/admin/forms" }
              : from === "list"
              ? { label: "거버넌스 요청 목록", href: "/governance/forms/list" }
              : { label: "데이터 거버넌스 문서 서식 모음", href: "/governance/forms" },
            { label },
          ]}
        />
      </div>

      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{label}</h1>
        <span className="font-mono text-sm text-gray-400">{form.request_no}</span>
        {/* 미리보기 — 거버넌스 요청 목록(from=list) 진입에서는 미노출 (조회만). */}
        {from !== "list" && (
          <button
            type="button"
            onClick={() => { setCopyDone(false); setPreviewOpen(true); }}
            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            <Eye size={12} /> 미리보기
          </button>
        )}
      </div>

      {/* 용역 제작 전용 진행 카드 — 5단계 막대 채우기형. */}
      {form.form_type === "data_production" && (
        <div className="mb-4">
          <ProgressBar
            stages={[...SERVICE_STAGES]}
            currentIndex={serviceStage}
            onStageClick={jumpServiceStage}
          />
        </div>
      )}

      {/* 진행 이력 가로 타임라인 — approval_history 의 이벤트 매핑. 용역 제작 한정. */}
      {form.form_type === "data_production" && (
        <div className="mb-4">
          <HistoryTimeline events={approvalHistoryToEvents(form.approval_history)} />
        </div>
      )}

      {/* 용역 제작 — 좌(1fr) 본문 + 우(300px sticky) 담당자 채팅 2단 레이아웃.
          그 외(구매/구독 등) 는 본문만. 본문 끝(맨 하단) 에 실무자 지정 카드 추가. */}
      <div
        className={
          form.form_type === "data_production"
            ? "grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[1fr_300px]"
            : ""
        }
      >
        <div className="min-w-0">

      {/* chevron 진행 바 / 진행 상태·이력 패널 노출 정책
          - from=admin (거버넌스 요청 관리): 검토/승인 화면이라 chevron 미노출.
              FormStatusPanel 은 admin 액션을 위해 그대로 노출.
          - from=list  (거버넌스 요청 목록): 순수 read-only 조회. 둘 다 미노출.
          - 그 외 (from=my, 기본): 둘 다 노출. */}
      {from !== "admin" && from !== "list" && (
        <FormProcessBar
          formType={form.form_type}
          status={form.status}
          history={form.approval_history}
          onSelectedStepChange={(step) => {
            // 신청서 작성 chevron(index 1) = 실제로 양식을 작성/편집할 수 있는 상태로 이동.
            // 본 상세는 read-only 라 step 1 클릭은 작성 화면과 동일한 편집 폼으로 진입시킴.
            if (step === 1) {
              router.push(buildEditHref(form, from));
              return;
            }
            setSelectedStep(step);
          }}
        />
      )}

      {/* 진행 상태 카드.
          - 용역 제작(data_production): 상단 5단계 ProgressBar 가 진행 상태를 표시하므로
            본 카드는 노출하지 않음.
          - from=admin + 관리자 + 타인 신청 → 관리자 액션 + 진행 이력 토글 노출.
          - from=list → 관리자 액션 숨김, 진행 이력 토글만 노출 (read-only).
          - from=my / 기본 진입 → 기존 동작 (액션 + 통합 활동 카드 하단). */}
      {selectedStep === null && form.form_type !== "data_production" && (() => {
        // 사내 정책상 관리 탭은 platform role 무관 모든 사용자에게 열려 있음.
        // 본인 신청서가 아닐 때만 관리자 레이아웃(진행 이력 inline + 코멘트 분리) 노출.
        const isAdminDetail =
          from === "admin" &&
          !!me &&
          me.user.email.toLowerCase() !== form.submitter_email.toLowerCase();
        const isListView = from === "list";
        const showInlineHistory = isAdminDetail || isListView;
        const inlineHistory = showInlineHistory
          ? approvalHistoryToStatusItems(form.approval_history, form.submitter_name)
          : undefined;
        return (
          <div id="form-status" className="scroll-mt-4">
            <FormStatusPanel
              formId={form.id}
              status={form.status}
              history={form.approval_history}
              me={me}
              submitterEmail={form.submitter_email}
              onChanged={refetch}
              inlineHistory={inlineHistory}
              hideAdminActions={isListView}
              viewAsAdmin={isAdminDetail}
            />
          </div>
        );
      })()}

      {/* 신청 정보 — 빨간 막대 + 제목 위에, 표 본문 아래. */}
      <div className={`mt-6 ${hideForm ? "hidden" : ""}`}>
        <div className="mb-3 flex items-center gap-1.5">
          <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-brand" />
          <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
            신청 정보
          </h3>
        </div>
        <div
          id="form-content"
          className="overflow-hidden rounded-lg border border-gray-200 bg-white scroll-mt-4"
        >
          <table className="w-full text-sm">
            <tbody>
              <Row label="신청자 이름">{form.submitter_name}</Row>
              <Row label="소속">{form.submitter_department || "-"}</Row>
              <Row label="이메일">{form.submitter_email}</Row>
              {allFields.map((f) => {
                // 첨부파일 — 신청서 양식과 동일하게 신청 정보 표의 마지막 행(조직장 승인 아래)
                // 으로 노출. 값 유무와 무관하게 항상 행을 보여주고 업로드/목록을 인라인 렌더.
                if (f.type === "attachment") {
                  return (
                    <Row key={f.key} label="첨부파일">
                      <AttachmentSection
                        formId={form.id}
                        backend={form.attachments}
                        embedded
                      />
                    </Row>
                  );
                }
                const v = form.payload[f.key];
                if (v === undefined || v === null || v === "") return null;
                // 확인 화면에서는 긴 안내 문구 라벨을 짧게 — 작성 화면 label 은 그대로.
                const displayLabel =
                  f.key === "조직장_승인_완료" ? "조직장 승인" : f.label;
                return (
                  <Row key={f.key} label={displayLabel}>
                    <FieldValue field={f} value={v} />
                  </Row>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 실무자 지정 — 신청서 확인 바로 아래, 본문 흐름 안.
          요청 관리 / 요청 목록 / 내 문서 목록 / 기본 진입 모두에서 노출 (Phase 1 권한 게이트 없음). */}
      {form.form_type === "data_production" && (
        <div className="mt-5">
          <ApplicationStageTab
            formId={form.id}
            formType={form.form_type}
            submitterEmail={form.submitter_email}
            submitterName={form.submitter_name}
            me={me}
            currentStage={serviceStage}
            subStep={subStep}
            onSubStepChange={setSubStep}
            onAdvanceStage={advanceServiceStage}
            onActivity={refetch}
          />
        </div>
      )}

      {/* 활동/코멘트 영역.
          - 용역 제작(data_production): 우측 ChatPanel 이 담당자 소통을 대체 → 코멘트 카드 미노출.
          - from=admin + 관리자 + 타인 신청 → 코멘트 카드 (사람 코멘트만, 시스템 이벤트 제외).
            진행 이력은 위 진행 상태 카드 안의 토글로 노출.
          - from=list → 동일 분리 레이아웃 (코멘트 카드). chatRole=observer 면 카드 자체 숨김.
          - 그 외 진입(my / 기본) → 기존 활동 카드 (시스템 + 사람 통합 타임라인). */}
      {form.form_type !== "data_production" && (() => {
        const chatRole = getChatRole(form, me);
        if (chatRole === "observer") return null;
        const isAdminDetail =
          from === "admin" &&
          !!me &&
          me.user.email.toLowerCase() !== form.submitter_email.toLowerCase();
        const isListView = from === "list";
        const useCommentsOnly = isAdminDetail || isListView;
        return (
          <div className="mt-4">
            <ProgressHistoryBlock
              formId={form.id}
              history={approvalHistoryToStatusItems(
                form.approval_history,
                form.submitter_name,
              )}
              canPostMessage
              currentUserName={me?.user.name ?? "나"}
              currentUserEmail={me?.user.email}
              currentUserRole={chatRole}
              applicantName={form.submitter_name}
              commentsOnly={useCommentsOnly}
              refreshNonce={messageRefreshNonce}
            />
          </div>
        );
      })()}

      {/* 첨부파일 — 스키마에 첨부파일 필드가 없는 유형은 표 아래 별도 섹션으로 노출.
          (data_production 등 인라인 행으로 노출되는 유형은 위 표 안에서 처리.) */}
      {!hasInlineAttachment && (
        <div className="mt-5">
          <AttachmentSection formId={form.id} backend={form.attachments} />
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {from === "admin" && (
          <Link
            href="/governance/admin/forms"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
          >
            <ArrowLeft size={12} /> 관리 페이지로 돌아가기
          </Link>
        )}
        {from === "my" && (
          <Link
            href="/governance/forms/my"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
          >
            <ArrowLeft size={12} /> 내 문서 목록
          </Link>
        )}
        {from === "list" && (
          <Link
            href="/governance/forms/list"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
          >
            <ArrowLeft size={12} /> 요청 목록으로 돌아가기
          </Link>
        )}
        {/* 수정 버튼 — 작성자 본인이거나 admin 이면 노출.
            본인: 진입 컨텍스트(my / list / 기본 / admin) 무관.
            admin: 타인 신청도 수정 가능 (검토 중 데이터 보정 등). */}
        {(() => {
          const isOwner =
            !!me &&
            me.user.email.toLowerCase() === form.submitter_email.toLowerCase();
          const isAdmin = me?.user.role === "admin";
          if (!isOwner && !isAdmin) return null;
          return (
            <button
              onClick={() => router.push(buildEditHref(form, from))}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-gray-50"
            >
              <Pencil size={12} /> 수정
            </button>
          );
        })()}
        {/* 상세 페이지의 삭제 버튼은 admin 의 '거버넌스 요청 관리' 진입 시에만 노출.
            '내 문서 목록' 에서는 행 단위 휴지통 아이콘으로, 그 외 컨텍스트(요청 목록 등)
            에서는 파괴적 액션을 띄우지 않음. */}
        {from === "admin" && (
          <DeleteFormButton
            formId={form.id}
            contextLabel={form.project_name}
            onDeleted={() => router.push("/governance/admin/forms")}
          />
        )}
        {form.status === "draft" && justEdited && (
          <button
            type="button"
            onClick={submitDraft}
            disabled={submitting}
            className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            <Send size={12} /> {submitting ? "제출 중..." : "제출"}
          </button>
        )}
      </div>
      </div>

      {/* 우측 ChatPanel — 용역 제작 전용. 좌측 폼 박스와 동일 높이로 stretch.
          fillParent=true 로 컬럼 높이 채움 (sticky 대신 좌측과 같이 스크롤). */}
      {form.form_type === "data_production" && (
        <div className="min-h-0">
          <ChatPanel
            formId={form.id}
            currentUserEmail={me?.user.email ?? ""}
            assigneeTeam={getChatAssignee().team}
            headerVariant="online"
            accent="brand"
            ensureFormId={async () => form.id}
            fillParent
            currentStage={serviceStage}
          />
        </div>
      )}
      </div>

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
              <strong className="font-semibold text-gray-800">&apos;{missingField}&apos;</strong> 항목을 입력해주세요. 신청을 수정한 뒤 다시 제출해 주세요.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMissingField(null)}
                className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => {
                  setMissingField(null);
                  if (form) router.push(buildEditHref(form, from));
                }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                수정하러 가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discussions(댓글 스레드) — 일단 제외. 백엔드와 FormCommentSection 컴포넌트는 그대로 유지.
          재노출이 필요해지면 아래 한 줄 복구:
          <FormCommentSection formId={form.id} me={me} /> */}

      {previewOpen && form && (
        <FormPreviewModal
          data={{
            typeLabel: label,
            projectName: form.project_name,
            submitterName: form.submitter_name,
            submitterDepartment: form.submitter_department || "",
            submitterEmail: form.submitter_email,
            payload: form.payload,
            fields: allFields,
          } satisfies PreviewData}
          copyDone={copyDone}
          onCopy={async () => {
            try {
              await copyPreviewToClipboard({
                typeLabel: label,
                projectName: form.project_name,
                submitterName: form.submitter_name,
                submitterDepartment: form.submitter_department || "",
                submitterEmail: form.submitter_email,
                payload: form.payload,
                fields: allFields,
              });
              setCopyDone(true);
              setTimeout(() => setCopyDone(false), 2000);
            } catch (e) {
              setError("클립보드 복사 실패: " + (e as Error).message);
            }
          }}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="w-[170px] bg-gray-50/50 px-4 py-3 align-middle text-[12px] text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
        {label}
      </td>
      <td className="px-4 py-3 align-middle text-[12px] text-gray-900 dark:text-gray-100">
        {children}
      </td>
    </tr>
  );
}

/**
 * 신청 값을 필드 타입/키에 따라 의미있는 형태로 렌더링.
 *
 *  - radio (옵션 있음) : 모든 옵션을 체크박스로 표시 (선택된 쪽만 채워진 박스)
 *  - 레포지토리 키워드  : 데이터베이스 아이콘 + 칩 형태
 *  - boolean           : ☑ 확인 완료 / 확인 필요
 *  - 그 외             : 일반 텍스트 (whitespace 보존)
 */
function FieldValue({ field, value }: { field: FieldDef; value: unknown }) {
  if (field.type === "radio" && field.options && field.options.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-5">
        {field.options.map((opt) => {
          const selected = value === opt;
          const Icon = selected ? CheckSquare : Square;
          return (
            <span key={opt} className="inline-flex items-center gap-1.5 text-sm">
              <Icon
                size={16}
                className={selected ? "text-blue-500" : "text-gray-300"}
                strokeWidth={selected ? 2.5 : 1.5}
              />
              <span className={selected ? "text-gray-900" : "text-gray-500"}>{opt}</span>
            </span>
          );
        })}
      </div>
    );
  }

  if (
    field.key.includes("레포지토리") ||
    field.key.toLowerCase().includes("repo")
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700">
        <Database size={13} className="text-gray-500" />
        {String(value)}
      </span>
    );
  }

  if (typeof value === "boolean") {
    if (value) {
      return (
        <span className="inline-flex items-center gap-1 text-[#0F6E56]">
          <CheckCircle2 size={14} aria-hidden="true" /> 확인 완료
        </span>
      );
    }
    return <span className="text-gray-500">확인 필요</span>;
  }

  if (field.type === "service_list" && Array.isArray(value)) {
    const items = (value as string[]).filter((s) => s && s.trim().length > 0);
    if (items.length === 0) return <span className="text-gray-400">-</span>;
    return (
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-sm">
            <span className="text-xs text-gray-500">서비스명 {i + 1}</span>
            <span className="ml-2">{s}</span>
          </li>
        ))}
      </ul>
    );
  }

  if (field.type === "date_range" && value && typeof value === "object") {
    const v = value as { start?: string; end?: string };
    if (!v.start && !v.end) return <span className="text-gray-400">-</span>;
    return (
      <span>
        {v.start || "?"} ~ {v.end || "?"}
      </span>
    );
  }

  if (field.type === "currency" && value && typeof value === "object") {
    const v = value as { kind?: string; custom?: string };
    if (v.kind === "기타") return <span>기타 ({v.custom || "-"})</span>;
    return <span>{v.kind || "-"}</span>;
  }

  if (field.type === "approver_list" && Array.isArray(value)) {
    const names = (value as string[]).filter((s) => s && s.trim().length > 0);
    if (names.length === 0) return <span className="text-gray-400">-</span>;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {names.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-2.5 text-sm text-gray-700"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">
              {approverInitials(name)}
            </span>
            <span>{name}</span>
          </span>
        ))}
      </div>
    );
  }

  if (field.type === "service_blocks" && Array.isArray(value)) {
    type Block = {
      service_name?: string;
      usage?: string;
      currency?: { kind?: string; custom?: string };
      cost?: string;
      payment_method?: string;
      members?: string[];
    };
    const blocks = (value as Block[]).filter((b) => b && (b.service_name || b.usage || b.cost));
    if (blocks.length === 0) return <span className="text-gray-400">-</span>;
    return (
      <div className="space-y-3">
        {blocks.map((b, i) => (
          <div key={i} className="rounded-md border border-gray-200 bg-gray-50/40 px-3 py-2 text-sm">
            <div className="font-semibold text-gray-900">
              서비스 {i + 1}{b.service_name ? ` · ${b.service_name}` : ""}
            </div>
            {b.usage && <div className="mt-1 text-gray-700">{b.usage}</div>}
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
              {b.cost && <span>비용: {b.cost}</span>}
              {b.currency?.kind && (
                <span>
                  통화: {b.currency.kind === "기타" ? `기타(${b.currency.custom || "-"})` : b.currency.kind}
                </span>
              )}
              {b.payment_method && <span>결제: {b.payment_method}</span>}
              {b.members && b.members.length > 0 && (
                <span>인원: {b.members.length}명 ({b.members.join(", ")})</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap">{String(value)}</span>;
}

