// 담당자 채팅 첨부 업로드 추상화.
//
// Phase 1: 실제 서버 업로드 없이 mock — 이미지는 dataURL(새로고침에도 미리보기 유지),
//   그 외 파일은 ObjectURL(세션 한정 다운로드) + 메타데이터.
// TODO(Phase 2): 아래 uploadChatAttachment 구현부만 실제 스토리지 업로드 호출로 교체하고
//   서버 URL 을 url 로 반환하면 됨. ChatPanel / ChatMessageBubble 은 ChatAttachment 결과만
//   사용하므로 그 컴포넌트들은 수정 불필요.

export interface ChatAttachment {
  id: string;
  name: string;
  /** bytes */
  size: number;
  mimeType: string;
  kind: "image" | "file";
  /** Phase1: dataURL(이미지) / objectURL(파일). Phase2: 서버 URL. */
  url: string;
}

// 신청서 첨부(AttachmentSection)와 동일한 용량 한도(50MB) 재사용.
export const CHAT_MAX_BYTES = 50 * 1024 * 1024;
// 허용 확장자(이미지 외) — 신청서 첨부 규칙 준용.
const CHAT_ALLOWED_EXT = ["pdf", "docx", "xlsx", "csv"];
export const CHAT_ACCEPT = ".pdf,.docx,.xlsx,.csv,image/*";

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** 첨부 표시용 — 확장자 라벨(배지 텍스트). */
export function chatExtLabel(name: string): string {
  const e = ext(name);
  if (!e) return "FILE";
  if (e === "xlsx" || e === "xls") return "XLS";
  if (e === "docx" || e === "doc") return "DOC";
  return e.toUpperCase().slice(0, 4);
}

/** 확장자별 색상 — 신청서 첨부 규칙과 동일. */
export function chatExtColor(name: string): string {
  const e = ext(name);
  if (e === "pdf") return "#A32D2D";
  if (e === "xlsx" || e === "xls" || e === "csv") return "#3B6D11";
  if (e === "docx" || e === "doc") return "#185FA5";
  return "#7C3AED"; // 이미지/기타
}

export function formatChatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** 허용 여부 검사 — 통과하면 null, 아니면 에러 메시지. */
export function validateChatFile(file: File): string | null {
  const isImage = file.type.startsWith("image/");
  if (!isImage && !CHAT_ALLOWED_EXT.includes(ext(file.name))) {
    return `"${file.name}" 은(는) 지원하지 않는 형식입니다. (PDF/DOCX/XLSX/CSV/이미지)`;
  }
  if (file.size > CHAT_MAX_BYTES) {
    return `"${file.name}" 은(는) 50MB 를 초과합니다.`;
  }
  return null;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** Phase 1 mock 업로드 — 서버 전송 없이 ChatAttachment 생성.
 *  TODO(Phase 2): 여기를 실제 업로드 API 호출로 교체하고 서버 URL 을 url 로 반환. */
export async function uploadChatAttachment(file: File): Promise<ChatAttachment> {
  const kind: ChatAttachment["kind"] = file.type.startsWith("image/")
    ? "image"
    : "file";
  // 이미지는 dataURL(영속) , 그 외 파일은 ObjectURL(세션 한정).
  const url =
    kind === "image" ? await readAsDataURL(file) : URL.createObjectURL(file);
  return {
    id: `chatatt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
    kind,
    url,
  };
}
