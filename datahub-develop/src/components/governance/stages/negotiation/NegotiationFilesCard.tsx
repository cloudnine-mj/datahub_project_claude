// 협의 자료 카드 — 협의 단계 채팅에 첨부된 파일을 자동 수집해 리스트로 표시.
//
// 수집 기준: 채팅 단계맵(dh:gov:chat-stages)에서 stage === 협의(1) 인 메시지의 첨부만.
//   다른 단계(신청/계약 등) 첨부는 제외. 신청자/담당자 동일 표시(다운로드만, 삭제 불가).
// Phase 1: 첨부는 ChatPanel 과 동일하게 dh:gov:chat-attachments mock 사용.
//   보낸이/시간은 메시지(api.listFormMessages) 에서 매칭.

"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { api } from "@/lib/governance/api-client-full";
import {
  chatExtColor,
  chatExtLabel,
  type ChatAttachment,
} from "@/lib/governance/chat-upload";

/** 협의 단계 인덱스 (0=신청, 1=협의, 2=계약 …). */
export const NEGOTIATION_STAGE_INDEX = 1;

const STAGE_MAP_KEY = (formId: string) => `dh:gov:chat-stages:${formId}`;
const ATTACH_MAP_KEY = (formId: string) => `dh:gov:chat-attachments:${formId}`;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${m}/${day} ${hh}:${mm}`;
}

interface CollectedFile {
  att: ChatAttachment;
  senderName: string;
  createdAt: string;
}

interface Props {
  formId: string;
  /** 채팅에서 파일 전송 후 부모가 bump 하면 다시 수집. */
  refreshNonce?: number;
}

export function NegotiationFilesCard({ formId, refreshNonce }: Props) {
  const [files, setFiles] = useState<CollectedFile[]>([]);

  const collect = useCallback(async () => {
    const stageMap = readJson<Record<string, number>>(
      STAGE_MAP_KEY(formId),
      {},
    );
    const attachMap = readJson<Record<string, ChatAttachment[]>>(
      ATTACH_MAP_KEY(formId),
      {},
    );
    let messages: { id: string; senderName: string; createdAt: string }[] = [];
    try {
      messages = await api.listFormMessages(formId);
    } catch {
      messages = [];
    }
    const out: CollectedFile[] = [];
    messages.forEach((m) => {
      const stage = stageMap[m.id] ?? 0;
      if (stage !== NEGOTIATION_STAGE_INDEX) return;
      const atts = attachMap[m.id] ?? [];
      atts.forEach((att) => {
        out.push({ att, senderName: m.senderName, createdAt: m.createdAt });
      });
    });
    setFiles(out);
  }, [formId]);

  useEffect(() => {
    void collect();
    const onFocus = () => void collect();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [collect, refreshNonce]);

  return (
    <section className="rounded-xl border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]"
        />
        <h3 className="text-[14px] font-medium text-gray-900 dark:text-gray-100">
          협의 자료
        </h3>
        <span className="text-[10px] text-gray-400">
          협의 단계 채팅 첨부 자동 수집
        </span>
      </header>

      {files.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-200 px-3 py-4 text-[11px] text-gray-400 dark:border-gray-700">
          <FileText size={14} aria-hidden="true" />
          협의 단계 채팅에 첨부된 파일이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map(({ att, senderName, createdAt }) => (
            <li
              key={att.id}
              className="flex items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[8px] font-medium text-white"
                style={{ background: chatExtColor(att.name) }}
                aria-hidden="true"
              >
                {chatExtLabel(att.name)}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-[12px] text-gray-900 dark:text-gray-100"
                title={att.name}
              >
                {att.name}
              </span>
              <span className="shrink-0 text-[10px] text-gray-400">
                {senderName} · {fmtTime(createdAt)}
              </span>
              <a
                href={att.url}
                download={att.name}
                aria-label={`${att.name} 다운로드`}
                className="shrink-0 rounded p-1 text-gray-400 transition hover:bg-gray-50 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <Download size={14} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
