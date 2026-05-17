// 추적 모드 — '제출된 신청 내용' 카드 아래에 노출되는 전자결재 품의 안내 박스.
//   status='approved' (승인 완료) 일 때만 렌더 — submitted/reviewing 에서는 미노출.
//   본문 안의 '미리보기' 단어는 실제 버튼 모양 인라인 칩으로 표현해, 사용자에게
//   어떤 버튼을 눌러야 하는지 시각적으로 안내.

import { Copy, Info } from "lucide-react";

export function ApprovalGuideBanner() {
  return (
    <div
      role="note"
      aria-label="전자결재 품의 안내"
      className="rounded-lg border border-gray-200 bg-red-50 px-3.5 py-3 dark:border-gray-800 dark:bg-red-900/20"
    >
      <div className="flex items-start gap-2.5">
        <Info
          size={16}
          aria-hidden="true"
          className="mt-0.5 shrink-0 text-red-700 dark:text-red-300"
        />
        <div className="flex-1 text-xs leading-relaxed text-red-700 dark:text-red-300">
          <p className="font-medium">전자결재 품의 안내</p>
          <p className="mt-0.5 text-gray-700 dark:text-gray-300">
            위의{" "}
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-px text-[11px] text-gray-700 align-[1px] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <Copy size={11} aria-hidden="true" />
              결재 본문 복사
            </span>{" "}
            버튼을 누르면 신청 내용을 g portal 전자결재 품의서 본문에 그대로 붙여 넣을 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}
