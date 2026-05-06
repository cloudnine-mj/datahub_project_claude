"use client";

/**
 * 정책 작성 폼의 "예시 보기" 모달.
 *
 * severity 별 4종 예시 (필수/권장/보안/승인 필요) 를 탭으로 전환하며 볼 수 있고,
 * 진입 시 `defaultSeverity` 에 해당하는 예시가 기본 선택된다.
 *
 * "이 예시로 채우기" 클릭 시 현재 보고 있는 예시를 부모(PostNewView) 폼에 일괄 입력.
 */

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { POLICY_EXAMPLES, type PolicyExample } from "@/lib/policyExample";
import type { Severity } from "@/lib/api";
import { SeverityBadge, SEVERITIES } from "./SeverityBadge";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 기본으로 보여줄 예시의 severity — 보통 작성 폼이 진입할 때의 컨텍스트 */
  defaultSeverity?: Severity;
  /** 클릭 시 호출 — 부모(PostNewView)가 받은 값으로 form state 를 채운다 */
  onApply: (example: PolicyExample) => void;
}

export function PolicyExampleModal({ open, onClose, defaultSeverity = "required", onApply }: Props) {
  const [tab, setTab] = useState<Severity>(defaultSeverity);

  // 모달이 새로 열릴 때마다 컨텍스트 severity 로 초기화
  useEffect(() => {
    if (open) setTab(defaultSeverity);
  }, [open, defaultSeverity]);

  if (!open) return null;

  const ex = POLICY_EXAMPLES[tab];

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
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              작성 예시
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

        {/* severity 탭 */}
        <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50/50 px-6 py-2">
          <span className="mr-2 text-xs text-gray-500">중요도별 예시:</span>
          {SEVERITIES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setTab(s.value)}
              className={
                "rounded-full px-3 py-1 text-xs font-semibold transition " +
                (tab === s.value
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 hover:bg-gray-100")
              }
            >
              {s.label}
            </button>
          ))}
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
          <Row label="핵심 요약">
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
              className="inline-flex items-center rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600"
            >
              이 예시로 채우기
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
