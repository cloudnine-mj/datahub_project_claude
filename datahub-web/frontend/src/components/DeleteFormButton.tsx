"use client";

/**
 * 신청 삭제 버튼 + 확인 다이얼로그.
 *
 * 사용처: 내 문서 목록의 각 행 — 컴팩트한 휴지통 아이콘으로 표시.
 * 삭제 성공 시 부모(`onDeleted`)가 목록을 재조회.
 */

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  formId: number;
  /** 삭제 성공 후 호출 — 목록 재조회용 */
  onDeleted: () => void;
  /** 다이얼로그에 표시할 식별자 (예: 프로젝트명 또는 REQ 번호) */
  contextLabel?: string;
}

export function DeleteFormButton({ formId, onDeleted, contextLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setError(null);
    setPending(true);
    try {
      await api.deleteForm(formId);
      onDeleted();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        title="삭제"
        aria-label="삭제"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
      >
        <Trash2 size={12} /> 삭제
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">신청을 삭제하시겠습니까?</h3>
            {contextLabel && (
              <p className="mt-1 truncate text-sm font-medium text-gray-700">{contextLabel}</p>
            )}
            <p className="mt-2 text-sm text-gray-600">
              삭제된 신청은 복구할 수 없습니다. 첨부된 파일도 함께 삭제됩니다.
            </p>
            {error && (
              <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setOpen(false)}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className="inline-flex items-center gap-1 rounded-md bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                <Trash2 size={14} /> {pending ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
