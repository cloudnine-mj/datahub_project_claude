// 새 데이터 업로드 모달 — 진행 단계 수령 데이터 카드의 [업로드] 클릭 시.
//   납품 선택(필수) + 파일 선택 + 자동 버전 표시 + 액션. 등록 시 카드 갱신.
//   변경점 메모 입력 없음 — 변경 사항은 채팅으로 공유.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudUpload, FileUp, X } from "lucide-react";
import {
  appendReceivedData,
  deliveryLabel,
  formatBytes,
  nextVersionFor,
  readReceivedData,
  type DeliveryRound,
} from "@/lib/governance/progress-storage";

const MAX_BYTES = 100 * 1024 * 1024;

interface Props {
  formId: string;
  uploader: string;
  onClose: () => void;
  /** 등록 직후 호출 — 부모가 진척 상태(progress state) 갱신 등 후속 처리. */
  onUploaded: (round: DeliveryRound, version: number) => void;
}

interface PickedFile {
  file: File;
  ext: string;
}

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function UploadDataModal({ formId, uploader, onClose, onUploaded }: Props) {
  const [round, setRound] = useState<DeliveryRound | null>(null);
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ESC 닫기.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 자동 버전 — 선택된 납품 안에서 기존 최대 + 1.
  const autoVersion = useMemo(() => {
    if (!round) return 0;
    return nextVersionFor(readReceivedData(formId), round);
  }, [formId, round]);

  function onSelectFiles(files: FileList | null): void {
    if (!files || files.length === 0) return;
    setErr(null);
    const accepted: PickedFile[] = [];
    const list = Array.from(files);
    list.forEach((f) => {
      if (f.size > MAX_BYTES) {
        setErr(`"${f.name}" 은(는) 100MB 를 초과합니다.`);
        return;
      }
      accepted.push({ file: f, ext: ext(f.name) });
    });
    if (accepted.length > 0) setPicked((prev) => [...prev, ...accepted]);
  }

  function removePicked(idx: number): void {
    setPicked((prev) => prev.filter((_, i) => i !== idx));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    onSelectFiles(e.dataTransfer.files);
  }

  function canSubmit(): boolean {
    return round !== null && picked.length > 0;
  }

  function submit(): void {
    if (!round) {
      setErr("납품을 선택해 주세요.");
      return;
    }
    if (picked.length === 0) {
      setErr("파일을 선택해 주세요.");
      return;
    }
    // 같은 납품에서 한 번 업로드로 여러 파일을 올리면, 각각 별 행으로 동일 버전을 공유.
    //   첫 파일에 대해 nextVersionFor 가 계산되고, 나머지는 동일 버전 라벨 유지를 위해
    //   storage 가 매 append 마다 +1 하지 않도록 같은 round 라도 첫 행만 신버전.
    //   단순화를 위해 Phase 1 은 1 회 업로드 = 1 파일 가정에 가깝게 — 다중 시 첫 파일만 신 버전,
    //   나머지는 같은 버전으로 묶고 싶지만 nextVersionFor 가 +1 씩 증가. UX 단순화 위해 그냥 +1 누적.
    const first = picked[0];
    const item = appendReceivedData(formId, {
      deliveryRound: round,
      fileName: first.file.name,
      fileSize: first.file.size,
      fileType: first.ext,
      uploader,
    });
    // 추가 파일도 같은 round 로 누적 등록(각각 v+1 부여).
    picked.slice(1).forEach((p) => {
      appendReceivedData(formId, {
        deliveryRound: round,
        fileName: p.file.name,
        fileSize: p.file.size,
        fileType: p.ext,
        uploader,
      });
    });
    onUploaded(round, item.version);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-data-title"
    >
      <div
        className="w-full max-w-[460px] rounded-xl bg-white p-5 shadow-xl dark:bg-gray-900"
        style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CloudUpload size={15} aria-hidden="true" className="text-[#D4533E]" />
            <h3
              id="upload-data-title"
              className="text-[14px] font-medium text-gray-900 dark:text-gray-100"
            >
              새 데이터 업로드
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </header>

        <p className="mb-3 text-[11px] leading-relaxed text-gray-600 dark:text-gray-300">
          메일·SharePoint로 받은 데이터를 업로드합니다. 납품을 선택하면 같은 납품 안에서 버전이 자동 부여됩니다.
        </p>

        {/* 납품 선택 (필수) */}
        <div className="mb-3">
          <label className="mb-1.5 block text-[11px] font-medium text-gray-700 dark:text-gray-200">
            납품 선택 <span style={{ color: "#D4533E" }}>*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <RoundButton
              round="middle"
              active={round === "middle"}
              caption="첫 납품"
              onClick={() => setRound("middle")}
            />
            <RoundButton
              round="modified"
              active={round === "modified"}
              caption="중간 피드백 반영"
              onClick={() => setRound("modified")}
            />
            <RoundButton
              round="final"
              active={round === "final"}
              caption="최종 납품"
              onClick={() => setRound("final")}
            />
          </div>
        </div>

        {/* 드래그·선택 영역 */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="mb-3 flex cursor-pointer flex-col items-center gap-1 rounded-md border-[0.5px] border-dashed border-[var(--color-border-secondary,#d1d5db)] bg-[var(--color-background-secondary,#f9fafb)] px-4 py-[18px] text-center transition hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <FileUp size={20} aria-hidden="true" className="text-[#D4533E]" />
          <span className="text-[11px] text-gray-700 dark:text-gray-200">
            파일을 드래그하거나 클릭하여 선택
          </span>
          <span className="text-[10px] text-[var(--color-text-tertiary,#9ca3af)]">
            단일/다중 파일, 최대 100MB
          </span>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onSelectFiles(e.target.files)}
          />
        </div>

        {picked.length > 0 && (
          <ul className="mb-3 flex flex-col gap-1">
            {picked.map((p, i) => (
              <li
                key={`${p.file.name}-${i}`}
                className="flex items-center gap-2 rounded-md border border-gray-100 px-2.5 py-1.5 text-[11px] dark:border-gray-800"
              >
                <span className="min-w-0 flex-1 truncate">{p.file.name}</span>
                <span className="shrink-0 text-[10px] text-gray-400">
                  {formatBytes(p.file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removePicked(i)}
                  aria-label={`${p.file.name} 제거`}
                  className="shrink-0 rounded p-0.5 text-gray-400 transition hover:text-red-600"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 자동 버전 표시 */}
        {round && (
          <div
            className="mb-3 rounded-md px-3 py-2 text-[11px]"
            style={{ background: "var(--color-background-secondary,#f3f4f6)" }}
          >
            <span className="text-gray-500 dark:text-gray-400">자동 버전</span>
            <span
              className="ml-2 inline-flex items-center text-[10px] font-medium"
              style={{ background: "#D4533E", color: "#fff", borderRadius: 4, padding: "2px 6px" }}
            >
              {round === "middle" ? "중간" : round === "modified" ? "수정" : "최종"} v
              {autoVersion}
            </span>
            <span className="ml-2 text-[10px] text-[var(--color-text-tertiary,#9ca3af)]">
              이전 {round === "middle" ? "중간" : round === "modified" ? "수정" : "최종"} v
              {autoVersion - 1} 다음
            </span>
          </div>
        )}

        {err && (
          <p className="mb-2 text-[11px] text-[#993C1D]" role="alert">
            {err}
          </p>
        )}

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-[11px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit()}
            className={
              canSubmit()
                ? "inline-flex items-center gap-1.5 rounded-md bg-[#D4533E] px-3.5 py-1.5 text-[11px] font-medium text-white transition hover:brightness-110"
                : "inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-[var(--color-background-secondary,#f3f4f6)] px-3.5 py-1.5 text-[11px] font-medium text-[var(--color-text-tertiary,#9ca3af)]"
            }
          >
            <CloudUpload size={13} aria-hidden="true" />
            {round
              ? `업로드 → ${round === "middle" ? "중간" : round === "modified" ? "수정" : "최종"} v${autoVersion} 등록`
              : "업로드"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoundButton({
  round,
  active,
  caption,
  onClick,
}: {
  round: DeliveryRound;
  active: boolean;
  caption: string;
  onClick: () => void;
}) {
  const label = deliveryLabel(round);
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "flex flex-col items-center gap-0.5 rounded-md border border-[#D4533E] bg-[#FCF3F0] px-2 py-2 text-[#D4533E] transition"
          : "flex flex-col items-center gap-0.5 rounded-md border-[0.5px] border-[var(--color-border-secondary,#d1d5db)] bg-white px-2 py-2 text-gray-700 transition hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200"
      }
    >
      <span className="text-[11px] font-medium">{label.replace(" 납품", "")}</span>
      <span
        className="text-[9px]"
        style={{ color: active ? "#D4533E" : "var(--color-text-tertiary,#9ca3af)" }}
      >
        {caption}
      </span>
      {active && <Check size={11} aria-hidden="true" className="text-[#D4533E]" />}
    </button>
  );
}
