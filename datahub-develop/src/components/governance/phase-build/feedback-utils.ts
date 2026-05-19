// 검수 피드백 첨부 파일 유틸 — 크기 포맷 / 파일 타입 아이콘 / 다중 파일 검증.

import {
  File as FileIcon,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";

export const MAX_FILES = 10;
export const MAX_SIZE_BYTES = 50 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface FileIconConfig {
  Icon: LucideIcon;
  /** Tailwind class for icon color. */
  className: string;
}

export function getFileIcon(filename: string): FileIconConfig {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["xlsx", "xls", "csv", "tsv"].includes(ext)) {
    return { Icon: FileSpreadsheet, className: "text-[#1D9E75]" };
  }
  if (["docx", "doc", "pdf", "hwp", "txt"].includes(ext)) {
    return { Icon: FileText, className: "text-blue-700 dark:text-blue-300" };
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) {
    return { Icon: ImageIcon, className: "text-[#185FA5]" };
  }
  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
    return { Icon: FileArchive, className: "text-[#854F0B]" };
  }
  return { Icon: FileIcon, className: "text-gray-400 dark:text-gray-500" };
}

export interface ValidatedFiles {
  accepted: File[];
  rejected: Array<{ file: File; reason: string }>;
}

export function validateFiles(files: File[], existingCount: number): ValidatedFiles {
  const accepted: File[] = [];
  const rejected: Array<{ file: File; reason: string }> = [];
  for (const file of files) {
    if (accepted.length + existingCount >= MAX_FILES) {
      rejected.push({ file, reason: `최대 ${MAX_FILES}개까지 첨부 가능합니다` });
      continue;
    }
    if (file.size > MAX_SIZE_BYTES) {
      rejected.push({ file, reason: "파일 크기가 50MB를 초과합니다" });
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejected };
}
