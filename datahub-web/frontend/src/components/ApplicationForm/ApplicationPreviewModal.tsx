// 제출된 신청서 전체 미리보기 모달 — 추적 모드의 '미리보기' 버튼에서 호출.
//   APPLICATION_FORM_CONFIG 기반으로 섹션·필드를 순회하며 값(또는 안내 placeholder) 노출.
//   ESC / 배경 클릭으로 닫힘. 양식 자체는 추적 모드에서 수정 불가하므로 읽기 전용 표시.

"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import {
  APPLICATION_FORM_CONFIG,
  APPLICATION_TYPE_LABEL,
  type ApplicationType,
} from "@/lib/applicationFormConfig";

interface Props {
  type: ApplicationType;
  values: Record<string, string>;
  onClose: () => void;
}

function formatValue(v: string | undefined): { text: string; empty: boolean } {
  const trimmed = (v ?? "").trim();
  if (!trimmed) return { text: "—", empty: true };
  // date-range 는 'YYYY-MM-DD~YYYY-MM-DD' 형식으로 직렬화됨.
  if (trimmed.includes("~")) {
    const [start, end] = trimmed.split("~");
    if (!start && !end) return { text: "—", empty: true };
    return { text: `${start || "(미입력)"} ~ ${end || "(미입력)"}`, empty: false };
  }
  return { text: trimmed, empty: false };
}

export function ApplicationPreviewModal({ type, values, onClose }: Props) {
  // ESC 로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sections = APPLICATION_FORM_CONFIG[type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="신청서 미리보기"
    >
      <div
        className="my-auto w-full max-w-2xl rounded-xl bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div>
            <h2 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
              신청서 미리보기
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {APPLICATION_TYPE_LABEL[type]} 신청 — 제출된 전체 내용
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            {sections.map((s) => (
              <section key={s.id}>
                <header className="mb-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="block h-3.5 w-[3px] rounded-sm bg-brand"
                  />
                  <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {s.title}
                  </h3>
                  {!s.required && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500">
                      (선택)
                    </span>
                  )}
                </header>
                <dl className="divide-y divide-gray-100 dark:divide-gray-800">
                  {s.fields.map((f) => {
                    const { text, empty } = formatValue(values[f.id]);
                    return (
                      <div
                        key={f.id}
                        className="grid grid-cols-[110px_1fr] gap-3 py-2"
                      >
                        <dt className="text-[12px] text-gray-500 dark:text-gray-400">
                          {f.label}
                        </dt>
                        <dd
                          className={`text-[13px] ${
                            empty
                              ? "text-gray-400 dark:text-gray-500"
                              : "text-gray-900 dark:text-gray-100"
                          }`}
                        >
                          {f.type === "file" && empty
                            ? "첨부 없음"
                            : text}
                          {f.unit && !empty && (
                            <span className="ml-1 text-gray-500 dark:text-gray-400">
                              {f.unit}
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
