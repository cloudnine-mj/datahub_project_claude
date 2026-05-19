"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import type { VisibilityMode, PublicAccess } from "@/lib/platform-client";

/**
 * 저장소 가시성 + fine-grained 6 capability 선택 UI.
 *
 * governance source-of-truth:
 *   docs/dev_docs/product-specs/repository-visibility-policy.md (Accepted)
 *
 * 동작:
 *   - 라디오 3개: Public / Private / Fine-grained
 *   - Fine-grained 선택 시 6 capability 체크박스 펼침
 *   - 의존(governance §Capability Dependency) 자동 enforce:
 *       file_read=true → file_list=true 강제
 *       file_list=true → metadata_read=true 강제
 *       lineage_read=true → metadata_read=true 강제
 *       stats_read=true → metadata_read=true 강제
 */

const PRESET_PUBLIC: PublicAccess = {
  discoverable: true,
  metadata_read: true,
  file_list: true,
  file_read: true,
  lineage_read: true,
  stats_read: true,
};

const PRESET_PRIVATE: PublicAccess = {
  discoverable: false,
  metadata_read: false,
  file_list: false,
  file_read: false,
  lineage_read: false,
  stats_read: false,
};

/** 프리셋 보내기 (visibility=fine_grained 의 시작점). public 의 capability 그대로. */
export function presetForFineGrained(): PublicAccess {
  return { ...PRESET_PUBLIC };
}

const CAPABILITIES: {
  key: keyof PublicAccess;
  label: string;
  desc: string;
}[] = [
  { key: "discoverable", label: "Discoverable", desc: "검색·카탈로그에 노출" },
  { key: "metadata_read", label: "Metadata", desc: "이름·설명·태그·라이선스 공개" },
  { key: "file_list", label: "File list", desc: "폴더·파일 목록 공개" },
  { key: "file_read", label: "File read", desc: "다운로드·내용 조회 허용" },
  { key: "lineage_read", label: "Lineage", desc: "Lineage 그래프 공개" },
  { key: "stats_read", label: "Stats", desc: "통계 (파일 수·크기) 공개" },
];

const RADIO_OPTIONS: {
  value: VisibilityMode;
  label: string;
  desc: string;
}[] = [
  { value: "public", label: "Public", desc: "누구나 검색·조회·다운로드" },
  { value: "fine_grained", label: "Fine-grained", desc: "비멤버 권한을 항목별로 직접 설정" },
  { value: "private", label: "Private", desc: "멤버만 접근" },
];

/** 의존을 enforce — 상위가 false 면 하위도 false 로. */
function applyDependencies(p: PublicAccess): PublicAccess {
  const next = { ...p };
  if (!next.metadata_read) {
    next.file_list = false;
    next.lineage_read = false;
    next.stats_read = false;
  }
  if (!next.file_list) {
    next.file_read = false;
  }
  return next;
}

export interface VisibilitySelectorProps {
  visibility: VisibilityMode;
  onVisibilityChange: (v: VisibilityMode) => void;
  publicAccess: PublicAccess;
  onPublicAccessChange: (pa: PublicAccess) => void;
}

export function VisibilitySelector({
  visibility,
  onVisibilityChange,
  publicAccess,
  onPublicAccessChange,
}: VisibilitySelectorProps) {
  const handleRadio = (next: VisibilityMode) => {
    if (next === "public") {
      onPublicAccessChange(PRESET_PUBLIC);
    } else if (next === "private") {
      onPublicAccessChange(PRESET_PRIVATE);
    } else {
      // fine_grained: 현재 값 유지 (이미 mixed 면 그대로). 처음 진입이면 public 프리셋 시작.
      const allTrue = Object.values(publicAccess).every(Boolean);
      const allFalse = Object.values(publicAccess).every((v) => !v);
      if (allTrue || allFalse) {
        onPublicAccessChange(presetForFineGrained());
      }
    }
    onVisibilityChange(next);
  };

  const handleCapToggle = (key: keyof PublicAccess, checked: boolean) => {
    const draft = { ...publicAccess, [key]: checked };
    const enforced = applyDependencies(draft);
    onPublicAccessChange(enforced);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-text-primary">Visibility</Label>
      <div className="flex flex-col gap-2">
        {RADIO_OPTIONS.map(({ value, label, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleRadio(value)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              visibility === value
                ? "border-brand bg-brand/5"
                : "border-dh-border hover:bg-bg-surface"
            }`}
          >
            <p className="text-sm font-medium text-text-primary">{label}</p>
            <p className="text-xs text-text-muted mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {visibility === "fine_grained" && (
        <div className="rounded-lg border border-dh-border bg-bg-surface p-3 space-y-2">
          <p className="text-xs font-medium text-text-secondary">
            비멤버에게 허용할 capability 를 선택하세요
          </p>
          {CAPABILITIES.map(({ key, label, desc }) => {
            const dep = isCapabilityDisabled(key, publicAccess);
            return (
              <label
                key={key}
                className={`flex items-start gap-2 text-sm ${
                  dep ? "opacity-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={publicAccess[key]}
                  disabled={dep}
                  onChange={(e) => handleCapToggle(key, e.target.checked)}
                />
                <span>
                  <span className="font-medium text-text-primary">{label}</span>
                  <span className="text-text-muted"> — {desc}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * 의존이 false 라서 자동 disable 해야 하는 capability 인지 판단.
 * (체크박스 값은 false 로 표시되지만 사용자가 직접 toggle 하지 못하도록.)
 */
function isCapabilityDisabled(
  key: keyof PublicAccess,
  pa: PublicAccess,
): boolean {
  switch (key) {
    case "file_read":
      return !pa.file_list;
    case "file_list":
    case "lineage_read":
    case "stats_read":
      return !pa.metadata_read;
    default:
      return false;
  }
}
