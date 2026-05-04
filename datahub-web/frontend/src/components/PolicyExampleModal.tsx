"use client";

/**
 * 정책 작성 폼의 "예시 보기" 모달.
 *
 * 시드 데이터(POLICY_EXAMPLE) 를 필드별로 보여주고,
 * "이 예시로 채우기" 버튼으로 작성 폼에 일괄 입력할 수 있게 한다.
 */

import { Sparkles, X } from "lucide-react";
import { POLICY_EXAMPLE } from "@/lib/policyExample";
import { SeverityBadge } from "./SeverityBadge";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 클릭 시 호출 — 부모(PostNewView)가 받은 값으로 form state 를 채운다 */
  onApply: (example: typeof POLICY_EXAMPLE) => void;
}

export function PolicyExampleModal({ open, onClose, onApply }: Props) {
  if (!open) return null;

  const ex = POLICY_EXAMPLE;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
              <Sparkles size={12} /> 작성 예시
            </div>
            <h2 className="mt-1 text-lg font-bold">{ex.label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="닫기"
          >
            <X size={16} />
          </button>
        </div>

        {/* 본문 — 필드별 예시 값 */}
        <div className="space-y-5 px-6 py-5 text-sm">
          <Row label="제목">{ex.title}</Row>
          <Row label="카테고리">{ex.category}</Row>

          <div className="my-2 border-t border-dashed border-gray-200" />
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
            정책 메타데이터
          </div>

          <Row label="한 줄 설명">{ex.summary}</Row>
          <Row label="중요도">
            <SeverityBadge severity={ex.severity} />
          </Row>
          <Row label="태그">
            <div className="flex flex-wrap gap-1.5">
              {ex.tags.map((t) => (
                <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                  #{t}
                </span>
              ))}
            </div>
          </Row>
          <Row label="적용 대상">{ex.applies_to}</Row>
          <Row label="TL;DR">
            <span className="whitespace-pre-wrap">{ex.tldr}</span>
          </Row>
          <Row label="해야 할 것">
            <ul className="list-inside list-disc space-y-1 text-gray-800">
              {ex.action_items.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Row>
          <Row label="예시 본문">
            <pre className="whitespace-pre-wrap font-sans text-[13px] text-gray-700">
              {ex.examples}
            </pre>
          </Row>

          <div className="my-2 border-t border-dashed border-gray-200" />
          <Row label="정책 본문">
            <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-gray-700">
              {ex.content}
            </pre>
          </Row>
        </div>

        {/* 푸터 — 액션 버튼 */}
        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-gray-200 bg-white px-6 py-3">
          <p className="text-xs text-gray-400">
            ※ &quot;이 예시로 채우기&quot; 클릭 시 현재 입력한 내용이 모두 덮어써집니다.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(ex);
                onClose();
              }}
              className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              <Sparkles size={14} /> 이 예시로 채우기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-4">
      <div className="pt-0.5 text-xs font-semibold text-gray-500">{label}</div>
      <div className="text-gray-800">{children}</div>
    </div>
  );
}
