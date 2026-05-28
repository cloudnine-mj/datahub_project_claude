// 용역 제작 요청서 작성 예시 모달 — [작성 예시] 버튼 클릭 시 노출.
//
// 표 형태: 항목 / 입력 내용 예시 두 컬럼. 사용자가 어떤 내용을 적어야 하는지
// 실제 사례로 참고할 수 있도록 ChatEXAONE 프롬프트 고도화 예시를 제시.
//
// 모달 닫기: Esc / 외부 클릭 / X 버튼.

"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface Row {
  label: string;
  example: string | string[];
}

const ROWS: Row[] = [
  { label: "관련 프로젝트 (PMS 기준)", example: "ChatEXAONE 프롬프트 추천 고도화" },
  {
    label: "데이터셋 활용 목적",
    example: "ChatEXAONE 후속 질문 추천 기능의 성능 향상을 위한 데이터셋 제작",
  },
  { label: "데이터셋 이름", example: "후속질문 추천 데이터셋" },
  {
    label: "작업 착수 희망일 (요청서 제출 기준으로 3주 이후부터 선택 가능)",
    example: "2025/6/16",
  },
  { label: "데이터 수령 희망일 (작업 마감 기한)", example: "2025/6/30" },
  {
    label: "작업 형태",
    example: [
      "1. 질문(Q), 답변(A), 그에 대한 후속 질문(FQ)로 이루어진 벤치마크 데이터셋 제작 (영문 + 국문)",
      "2. 사람 작업자의 후속 질문 평가 진행 (A/B/C test)",
    ],
  },
  { label: "작업 도구", example: "엑셀 (별도 툴 필요 없음)" },
  { label: "목표 데이터 수량", example: "3,500건" },
  {
    label: "목표 데이터 수량 (단위 상세)",
    example: [
      "Seed Q: 500개",
      "Following Q 8지선다 선택: 2500건",
      "AB test: 500건 (A vs. B1 / A vs. B2 / A vs. B3 / A vs. B4 의 형태로 총 2000개 평가 결과 필요)",
    ],
  },
  {
    label: "데이터 1개당 필요 작업자",
    example: "최소 5인 (seed Q 5명이 100개씩 제작) 이후 작업 데이터당 인원 제한 없음",
  },
  { label: "작업자 보유 기술", example: "영어모어화자" },
  {
    label: "품질 평가 방식",
    example: "납품 데이터에 대해 g-eval 진행 + 일부 랜덤 sampling 하여 직접 검수",
  },
];

export function ServiceExampleModal({ onClose }: { onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-example-title"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-[720px] flex-col rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <header className="sticky top-0 z-10 rounded-t-xl border-b border-gray-100 bg-white px-7 pb-4 pt-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-1 flex items-center justify-between">
            <h2
              id="service-example-title"
              className="text-[17px] font-medium text-gray-900 dark:text-gray-100"
            >
              작성 예시
            </h2>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            데이터 용역 제작 요청서 작성 시 참고할 수 있는 항목별 예시입니다.
          </p>
        </header>

        {/* 본문 — 표 */}
        <div className="flex-1 overflow-y-auto px-7 py-5">
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-[12px]">
              <thead className="bg-gray-50 text-left dark:bg-gray-800/40">
                <tr>
                  <th className="w-[200px] border-b border-gray-200 px-4 py-3 font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                    항목
                  </th>
                  <th className="border-b border-gray-200 px-4 py-3 font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                    입력 내용 예시
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => {
                  const isLast = i === ROWS.length - 1;
                  return (
                    <tr
                      key={r.label}
                      className={isLast ? "" : "border-b border-gray-200 dark:border-gray-700"}
                    >
                      <td className="bg-gray-50/40 px-4 py-3 align-top text-gray-500 dark:bg-gray-800/20 dark:text-gray-400">
                        {r.label}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-900 dark:text-gray-100">
                        {Array.isArray(r.example) ? (
                          <div className="space-y-1">
                            {r.example.map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                          </div>
                        ) : (
                          r.example
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 푸터 */}
        <footer className="sticky bottom-0 flex justify-end rounded-b-xl border-t border-gray-100 bg-white px-7 py-4 dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
