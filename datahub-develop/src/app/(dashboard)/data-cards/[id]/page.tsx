"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileText } from "lucide-react";
import MetadataTable from "@/components/catalog/MetadataTable";
import TabSection from "@/components/catalog/TabSection";
import OwnerStatusBadge from "@/components/catalog/OwnerStatusBadge";
import DownloadButton from "@/components/catalog/DownloadButton";
import type { TableInfo } from "@/lib/platform-client";
import type { DatasetMetadata } from "@/lib/catalog-types";

interface DatasetDetail extends TableInfo {
  metadata: DatasetMetadata;
}

interface LinkedPlan {
  id: string;
  dataName: string;
  status: string;
}

export default function DatasetDetailPage() {
  const params = useParams();
  const fullName = decodeURIComponent(params.id as string);
  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkedPlan, setLinkedPlan] = useState<LinkedPlan | null>(null);

  const fetchDataset = useCallback(() => {
    fetch(`/api/catalog/datasets/${encodeURIComponent(fullName)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setDataset(data);
        if (data?.table_name) {
          const searchName = data.table_name.replace(/_/g, "-");
          fetch(`/api/plans?search=${encodeURIComponent(searchName)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((res) => {
              const plans = Array.isArray(res) ? res : res?.data ?? [];
              const match = plans.find(
                (p: any) => p.dataName === searchName,
              );
              if (match) setLinkedPlan(match);
            })
            .catch(() => {});
        }
      })
      .catch(() => setDataset(null))
      .finally(() => setIsLoading(false));
  }, [fullName]);

  useEffect(() => {
    fetchDataset();
  }, [fetchDataset]);

  const handleSaveField = async (field: string, value: string) => {
    if (!dataset) return;
    try {
      const res = await fetch(
        `/api/catalog/datasets/${encodeURIComponent(fullName)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [field]: value }),
        },
      );
      if (res.ok) {
        const updated = await res.json();
        setDataset(updated);
      }
    } catch (err) {
      console.error("Failed to update field:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-400">
        데이터셋 정보를 불러오는 중...
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-12 text-gray-400">
        데이터셋을 찾을 수 없습니다.
      </div>
    );
  }

  const hasOwner = !!dataset.metadata?.owner;

  return (
    <div>
      <Link
        href="/data-cards"
        className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        검색 결과로 돌아가기
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        {dataset.table_name}
      </h1>

      <div className="mt-3 flex items-center justify-between">
        <div>{!hasOwner && <OwnerStatusBadge />}</div>
        <div className="flex items-center gap-2">
          {linkedPlan && (
            <Link
              href={`/plans/${linkedPlan.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <FileText className="h-4 w-4" />
              레포지토리 명세 보기
            </Link>
          )}
          <DownloadButton
            repoName={dataset.table_name.replace(/_/g, "-")}
            tableName={dataset.table_name}
            fullName={dataset.full_name}
            group={dataset.schema_name}
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400">
        각 항목을 클릭하면 수정할 수 있습니다.
      </p>

      <div className="mt-4">
        <MetadataTable
          table={dataset}
          metadata={dataset.metadata}
          onSave={handleSaveField}
          onAiGenerated={fetchDataset}
        />
      </div>

      <TabSection
        tableName={dataset.table_name}
        fullName={dataset.full_name}
        catalogName={dataset.catalog_name}
        description={dataset.metadata?.dataset_description}
        group={dataset.schema_name}
      />
    </div>
  );
}
