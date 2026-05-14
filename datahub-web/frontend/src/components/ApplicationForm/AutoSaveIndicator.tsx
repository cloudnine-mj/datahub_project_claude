// 자동 저장 인디케이터 — 작성 모드(draft) 에서만 노출.
//   relativeLabel 은 외부에서 갱신 (mock 에서는 '방금 전' 고정).

import { Cloud } from "lucide-react";

interface Props {
  relativeLabel?: string;
}

export function AutoSaveIndicator({ relativeLabel = "방금 전" }: Props) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-1.5 text-[11px] text-gray-500 dark:bg-gray-800/40 dark:text-gray-400">
      <Cloud size={12} aria-hidden="true" />
      <span>자동 저장됨 · {relativeLabel}</span>
    </div>
  );
}
