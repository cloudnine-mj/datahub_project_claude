// 진행 단계(3/4) sessionStorage CRUD 헬퍼.
//
// Phase 1: 백엔드 컬럼 없이 진행 단계 데이터를 sessionStorage 에 영속.
//   - dh:gov:received-data:{formId}     — 수령 데이터(납품·버전·파일·상태) 누적 목록
//   - dh:gov:feedback-history:{formId}  — 피드백 이력(텍스트 + 첨부)
//   - dh:gov:progress:{formId}:state    — 진행 단계 4단계 진척 상태
// Phase 2: ReceivedData / FeedbackHistory / ProgressState 테이블 + API 로 교체.
//   read/write 시그니처는 유지.

export type DeliveryRound = "middle" | "modified" | "final";

export type ReceivedStatus =
  | "confirmed" // 확인 완료
  | "reviewing" // 확인 중
  | "redelivery_requested" // 재수령
  | "pending"; // 대기

export interface ReceivedDataItem {
  id: string;
  deliveryRound: DeliveryRound;
  version: number;
  fileName: string;
  fileSize: number;
  /** 확장자 소문자(예: 'pdf','zip','xlsx'). 아이콘·색상 매핑용. */
  fileType: string;
  uploader: string;
  uploadedAt: string; // ISO
  status: ReceivedStatus;
}

export interface FeedbackAttachmentMeta {
  name: string;
  size: number;
  type: string;
}

export interface FeedbackItem {
  id: string;
  targetDeliveryRound: DeliveryRound;
  targetVersion: number;
  content?: string;
  attachments: FeedbackAttachmentMeta[];
  author: string;
  createdAt: string; // ISO
  status: "sent" | "pending";
}

export interface ProgressState {
  middleCompleted: boolean;
  modifiedCompleted: boolean;
  finalReviewing: boolean;
  closureStarted: boolean;
}

const RECEIVED_KEY = (formId: string) => `dh:gov:received-data:${formId}`;
const FEEDBACK_KEY = (formId: string) => `dh:gov:feedback-history:${formId}`;
const STATE_KEY = (formId: string) => `dh:gov:progress:${formId}:state`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function dispatchChanged(formId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("dh:gov:progress-changed", { detail: { formId } }),
  );
}

// ── 수령 데이터 ──────────────────────────────────────────────────────────────

export function readReceivedData(formId: string): ReceivedDataItem[] {
  return readJson<ReceivedDataItem[]>(RECEIVED_KEY(formId), []);
}

/** 같은 납품 안에서 다음 버전 번호 = 기존 최대 + 1. */
export function nextVersionFor(
  list: ReceivedDataItem[],
  round: DeliveryRound,
): number {
  let max = 0;
  list.forEach((item) => {
    if (item.deliveryRound === round && item.version > max) max = item.version;
  });
  return max + 1;
}

export function appendReceivedData(
  formId: string,
  next: Omit<ReceivedDataItem, "id" | "uploadedAt" | "status" | "version"> & {
    status?: ReceivedStatus;
  },
): ReceivedDataItem {
  const current = readReceivedData(formId);
  const item: ReceivedDataItem = {
    id: `recv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deliveryRound: next.deliveryRound,
    version: nextVersionFor(current, next.deliveryRound),
    fileName: next.fileName,
    fileSize: next.fileSize,
    fileType: next.fileType,
    uploader: next.uploader,
    uploadedAt: new Date().toISOString(),
    status: next.status ?? "reviewing",
  };
  writeJson(RECEIVED_KEY(formId), [...current, item]);
  dispatchChanged(formId);
  return item;
}

// ── 피드백 이력 ──────────────────────────────────────────────────────────────

export function readFeedbackHistory(formId: string): FeedbackItem[] {
  return readJson<FeedbackItem[]>(FEEDBACK_KEY(formId), []);
}

export function appendFeedback(
  formId: string,
  next: Omit<FeedbackItem, "id" | "createdAt" | "status"> & {
    status?: "sent" | "pending";
  },
): FeedbackItem {
  const current = readFeedbackHistory(formId);
  const item: FeedbackItem = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetDeliveryRound: next.targetDeliveryRound,
    targetVersion: next.targetVersion,
    content: next.content,
    attachments: next.attachments,
    author: next.author,
    createdAt: new Date().toISOString(),
    status: next.status ?? "sent",
  };
  writeJson(FEEDBACK_KEY(formId), [...current, item]);
  dispatchChanged(formId);
  return item;
}

// ── 진행 단계 진척 상태 ──────────────────────────────────────────────────────

const EMPTY_STATE: ProgressState = {
  middleCompleted: false,
  modifiedCompleted: false,
  finalReviewing: false,
  closureStarted: false,
};

export function readProgressState(formId: string): ProgressState {
  return { ...EMPTY_STATE, ...readJson<Partial<ProgressState>>(STATE_KEY(formId), {}) };
}

export function writeProgressState(
  formId: string,
  patch: Partial<ProgressState>,
): ProgressState {
  const next = { ...readProgressState(formId), ...patch };
  writeJson(STATE_KEY(formId), next);
  dispatchChanged(formId);
  return next;
}

// ── 라벨/색상 매핑 (UI 공용) ─────────────────────────────────────────────────

export function deliveryLabel(round: DeliveryRound): string {
  return round === "middle" ? "중간 납품" : round === "modified" ? "수정 납품" : "최종 납품";
}

export function deliveryShortLabel(round: DeliveryRound): string {
  return round === "middle" ? "중간" : round === "modified" ? "수정" : "최종";
}

export function deliveryColors(round: DeliveryRound): { bg: string; text: string } {
  if (round === "middle") return { bg: "#E6F1FB", text: "#0C447C" };
  if (round === "modified") return { bg: "#FAEEDA", text: "#854F0B" };
  return { bg: "#FCF3F0", text: "#D4533E" };
}

const FILE_TYPE_COLOR: Record<string, string> = {
  pdf: "#A32D2D",
  csv: "#3B6D11",
  zip: "#3B6D11",
  xlsx: "#3B6D11",
  xls: "#3B6D11",
  md: "#185FA5",
  docx: "#185FA5",
  doc: "#185FA5",
  json: "#7C3AED",
  png: "#7C3AED",
  jpg: "#7C3AED",
  jpeg: "#7C3AED",
};

export function fileTypeColor(ext: string): string {
  return FILE_TYPE_COLOR[ext.toLowerCase()] ?? "#6B7280";
}

export function fileTypeLabel(ext: string): string {
  const e = ext.toLowerCase();
  if (!e) return "FILE";
  if (e === "xlsx" || e === "xls") return "XLS";
  if (e === "docx" || e === "doc") return "DOC";
  return e.toUpperCase().slice(0, 4);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** YYYY-MM-DD HH:mm */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}
