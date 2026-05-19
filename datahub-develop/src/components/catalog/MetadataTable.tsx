"use client";

import { useState } from "react";
import type { DatasetMetadata } from "@/lib/catalog-types";
import type { TableInfo } from "@/lib/platform-client";
import { METADATA_LABELS, METADATA_FIELD_ORDER } from "@/lib/catalog-types";
import MetadataBadge from "./MetadataBadge";
import OwnerStatusBadge from "./OwnerStatusBadge";

interface MetadataTableProps {
  table: TableInfo;
  metadata: DatasetMetadata;
  onSave?: (field: string, value: string) => Promise<void>;
  onAiGenerated?: () => void;
}

/** dataset_name, storage_location은 UC 테이블 자체 필드이므로 편집 불가. */
const READ_ONLY_FIELDS = new Set(["dataset_name", "storage_location"]);

function renderValue(field: string, value: string | null | undefined) {
  const display = value || "-";

  if (field === "modality" && value) {
    const items = value.split(",").map((v) => v.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((m) => (
          <MetadataBadge key={m} type="modality" value={m} />
        ))}
      </div>
    );
  }

  if (field === "data_card_tier" && value) {
    return <MetadataBadge type="data_card_tier" value={value} />;
  }

  if (field === "tags" && value) {
    const items = value.split(",").map((v) => v.trim()).filter(Boolean);
    return (
      <div className="flex flex-wrap gap-1">
        {items.map((t) => (
          <MetadataBadge key={t} type="tags" value={t} />
        ))}
      </div>
    );
  }

  return <span>{display}</span>;
}

function EditableRow({
  field,
  value,
  onSave,
}: {
  field: string;
  value: string | null | undefined;
  onSave?: (field: string, value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(field, input);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setInput(value || "");
    setEditing(false);
  };

  return (
    <tr className="border-b border-gray-200 last:border-b-0 group">
      <td className="px-6 py-3 bg-gray-50 text-gray-600 font-medium w-40 whitespace-nowrap">
        {METADATA_LABELS[field]}
      </td>
      <td className="px-6 py-3 text-gray-900">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              className="flex-1 px-2 py-1 text-sm border border-teal-400 rounded outline-none focus:ring-1 focus:ring-teal-500"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "..." : "저장"}
            </button>
            <button
              onClick={handleCancel}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              취소
            </button>
          </div>
        ) : (
          <div
            className={onSave ? "flex items-center justify-between cursor-pointer group/row" : ""}
            onClick={() => {
              if (!onSave) return;
              setInput(value || "");
              setEditing(true);
            }}
          >
            <div>{renderValue(field, value)}</div>
            {onSave && (
              <svg
                className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                />
              </svg>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export default function MetadataTable({ table, metadata, onSave, onAiGenerated }: MetadataTableProps) {
  const [aiLoading, setAiLoading] = useState(false);

  const handleAiGenerate = async () => {
    setAiLoading(true);
    try {
      const repoName = table.table_name.replace(/_/g, "-");

      const res = await fetch("/api/catalog/ai/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo: repoName,
          full_name: table.full_name,
        }),
      });

      if (res.ok) {
        onAiGenerated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "AI 메타데이터 생성에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-2">
        <button
          onClick={handleAiGenerate}
          disabled={aiLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {aiLoading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              생성 중...
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI 채우기
            </>
          )}
        </button>
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {METADATA_FIELD_ORDER.map((field) => (
              <EditableRow
                key={field}
                field={field}
                value={metadata[field as keyof DatasetMetadata] as string | null | undefined}
                onSave={READ_ONLY_FIELDS.has(field) ? undefined : onSave}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
