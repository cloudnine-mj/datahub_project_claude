// 수령 데이터 카드 — 진행 단계 페이지 전체 폭.
//   납품(중간/수정/최종) 단위로 버전을 누적해 표로 표시. 행 클릭 영역 없이 파일명 클릭만 다운로드.
//   필터(전체/중간/수정/최종) + [업로드] 버튼. 최신 행은 #FCF8EF 강조 + "최신" 뱃지.

"use client";

import { useEffect, useMemo, useState } from "react";
import { CloudUpload, Info } from "lucide-react";
import {
  deliveryColors,
  deliveryLabel,
  deliveryShortLabel,
  fileTypeColor,
  fileTypeLabel,
  formatBytes,
  formatDateTime,
  readReceivedData,
  type DeliveryRound,
  type ReceivedDataItem,
} from "@/lib/governance/progress-storage";

type Filter = "all" | DeliveryRound;

interface Props {
  formId: string;
  onUploadClick: () => void;
}

export function ReceivedDataCard({ formId, onUploadClick }: Props) {
  const [items, setItems] = useState<ReceivedDataItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    function refresh(): void {
      setItems(readReceivedData(formId));
    }
    refresh();
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ formId?: string }>).detail;
      if (!detail || detail.formId === formId) refresh();
    };
    window.addEventListener("dh:gov:progress-changed", onChange);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("dh:gov:progress-changed", onChange);
      window.removeEventListener("focus", refresh);
    };
  }, [formId]);

  // 최신 행 = 가장 최근 업로드(시각 기준). 강조 표시·"최신" 뱃지에 사용.
  const latestId = useMemo(() => {
    if (items.length === 0) return null;
    let latest = items[0];
    items.forEach((it) => {
      if (it.uploadedAt > latest.uploadedAt) latest = it;
    });
    return latest.id;
  }, [items]);

  // 같은 (납품, 버전 최대) 의 행에 "최신 버전" 뱃지(빨강) 적용을 위해 납품별 최대 버전 계산.
  const maxVersionByRound = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((it) => {
      if (!map[it.deliveryRound] || it.version > map[it.deliveryRound]) {
        map[it.deliveryRound] = it.version;
      }
    });
    return map;
  }, [items]);

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((it) => it.deliveryRound === filter)),
    [items, filter],
  );

  // 표시 정렬 — 최신 위(업로드일시 desc).
  const sorted = useMemo(() => {
    const copy = filtered.slice();
    copy.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
    return copy;
  }, [filtered]);

  return (
    <section className="rounded-[11px] border-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] bg-white px-[15px] py-[13px] dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span aria-hidden="true" className="block h-3.5 w-[3px] rounded-[1px] bg-[#D4533E]" />
        <h3 className="text-[12px] font-medium text-gray-900 dark:text-gray-100">
          수령 데이터
        </h3>
        <span
          className="inline-flex items-center text-[10px]"
          style={{
            background: "var(--color-background-secondary,#f3f4f6)",
            color: "var(--color-text-secondary,#6b7280)",
            borderRadius: 5,
            padding: "1px 7px",
          }}
        >
          총 {items.length}건
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            전체
          </FilterButton>
          <FilterButton active={filter === "middle"} onClick={() => setFilter("middle")}>
            중간
          </FilterButton>
          <FilterButton
            active={filter === "modified"}
            onClick={() => setFilter("modified")}
          >
            수정
          </FilterButton>
          <FilterButton active={filter === "final"} onClick={() => setFilter("final")}>
            최종
          </FilterButton>
          <button
            type="button"
            onClick={onUploadClick}
            className="inline-flex items-center gap-1 rounded-md bg-[#D4533E] px-2.5 py-1 text-[10px] font-medium text-white transition hover:brightness-110"
          >
            <CloudUpload size={12} aria-hidden="true" /> 업로드
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr
              className="text-left"
              style={{
                background: "var(--color-background-secondary,#f3f4f6)",
                color: "var(--color-text-secondary,#6b7280)",
              }}
            >
              <Th width="80px">납품 구분</Th>
              <Th width="60px">버전</Th>
              <Th>파일명</Th>
              <Th width="70px" align="right">크기</Th>
              <Th width="70px">업로드자</Th>
              <Th width="130px">업로드일시</Th>
              <Th width="80px" align="center">상태</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-3 py-6 text-center text-[11px] text-[var(--color-text-tertiary,#9ca3af)]"
                >
                  아직 업로드된 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              sorted.map((it) => (
                <Row
                  key={it.id}
                  item={it}
                  isLatest={it.id === latestId}
                  isLatestVersion={maxVersionByRound[it.deliveryRound] === it.version}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary,#9ca3af)]">
        <Info size={11} aria-hidden="true" />
        파일명을 클릭하면 다운로드됩니다
      </p>
    </section>
  );
}

function Th({
  children,
  width,
  align = "left",
}: {
  children: React.ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      className="border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)] px-2.5 py-1.5 font-medium"
      style={{ width, textAlign: align }}
    >
      {children}
    </th>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-md border-[0.5px] border-[#D4533E] bg-[#FCF3F0] px-2 py-[3px] text-[10px] text-[#D4533E]"
          : "rounded-md border-[0.5px] border-[var(--color-border-secondary,#d1d5db)] bg-white px-2 py-[3px] text-[10px] text-gray-600 transition hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300"
      }
    >
      {children}
    </button>
  );
}

function statusBadge(status: ReceivedDataItem["status"]): {
  label: string;
  bg: string;
  color: string;
} {
  switch (status) {
    case "confirmed":
      return { label: "확인 완료", bg: "#E1F5EE", color: "#0F6E56" };
    case "reviewing":
      return { label: "확인 중", bg: "#FAEEDA", color: "#854F0B" };
    case "redelivery_requested":
      return { label: "재수령", bg: "#FAEEDA", color: "#854F0B" };
    default:
      return {
        label: "대기",
        bg: "var(--color-background-secondary,#f3f4f6)",
        color: "var(--color-text-secondary,#6b7280)",
      };
  }
}

function Row({
  item,
  isLatest,
  isLatestVersion,
}: {
  item: ReceivedDataItem;
  isLatest: boolean;
  isLatestVersion: boolean;
}) {
  const dc = deliveryColors(item.deliveryRound);
  const sb = statusBadge(item.status);

  // 클릭 시 다운로드 — Phase 1: mock(파일 실제 저장 안 함). 안내만 띄움.
  function onDownload(): void {
    if (typeof window !== "undefined") {
      window.alert(`${item.fileName} 다운로드 (Phase 1 mock)`);
    }
  }

  return (
    <tr
      className="border-b-[0.5px] border-[var(--color-border-tertiary,#e5e7eb)]"
      style={isLatest ? { background: "#FCF8EF" } : undefined}
    >
      <Td>
        <span
          className="inline-flex items-center text-[9px] font-medium"
          style={{ background: dc.bg, color: dc.text, borderRadius: 4, padding: "2px 6px" }}
        >
          {deliveryLabel(item.deliveryRound)}
        </span>
      </Td>
      <Td>
        <span
          className="inline-flex items-center text-[9px] font-medium"
          style={
            isLatestVersion
              ? { background: "#D4533E", color: "#fff", borderRadius: 4, padding: "2px 6px" }
              : {
                  background: "var(--color-background-secondary,#f3f4f6)",
                  color: "#111827",
                  borderRadius: 4,
                  padding: "2px 6px",
                }
          }
        >
          v{item.version}
        </span>
      </Td>
      <Td>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] text-[8px] font-medium text-white"
            style={{ background: fileTypeColor(item.fileType) }}
            aria-hidden="true"
          >
            {fileTypeLabel(item.fileType)}
          </span>
          <button
            type="button"
            onClick={onDownload}
            className={`text-[#D4533E] hover:underline ${isLatest ? "font-medium" : ""}`}
          >
            {item.fileName}
          </button>
          {isLatest && (
            <span
              className="inline-flex items-center text-[9px] font-medium"
              style={{ background: "#FCF3F0", color: "#D4533E", borderRadius: 4, padding: "1px 5px" }}
            >
              최신
            </span>
          )}
        </span>
      </Td>
      <Td align="right">
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatBytes(item.fileSize)}
        </span>
      </Td>
      <Td>{item.uploader}</Td>
      <Td>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatDateTime(item.uploadedAt)}
        </span>
      </Td>
      <Td align="center">
        <span
          className="inline-flex items-center text-[9px] font-medium"
          style={{ background: sb.bg, color: sb.color, borderRadius: 4, padding: "2px 6px" }}
        >
          {sb.label}
        </span>
      </Td>
    </tr>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <td className="px-2.5 py-2 align-middle" style={{ textAlign: align }}>
      {children}
    </td>
  );
}

// internal — deliveryShortLabel 은 다른 컴포넌트에서 재사용 가능하도록 re-export 만 해두기.
export { deliveryShortLabel };
