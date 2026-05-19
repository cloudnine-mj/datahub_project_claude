"use client";

import Link from "next/link";
import type { TableInfo } from "@/lib/platform-client";
import MetadataBadge from "./MetadataBadge";
import OwnerStatusBadge from "./OwnerStatusBadge";

interface DatasetCardProps {
  table: TableInfo;
}

export default function DatasetCard({ table }: DatasetCardProps) {
  const props = table.properties || {};
  const modalities = props.modality
    ? props.modality.split(",").map((v) => v.trim()).filter(Boolean)
    : [];
  const tier = props.data_card_tier;
  const hasReadme = !!(props.tags && props.tags.toLowerCase().includes("readme")) ||
    !!(table.comment && table.comment.length > 100);
  const hasOwner = !!props.owner;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:border-l-4 hover:border-l-teal-600 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <Link
            href={`/data-cards/${encodeURIComponent(table.full_name)}`}
            className="text-base font-semibold text-gray-900 hover:text-teal-700 transition-colors"
          >
            {table.table_name}
          </Link>
          <p className="mt-1 text-xs font-mono text-gray-400 truncate">
            {table.full_name}
          </p>
          {table.comment && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              {table.comment}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {modalities.map((m) => (
              <MetadataBadge key={m} type="modality" value={m} />
            ))}
            {tier && <MetadataBadge type="data_card_tier" value={tier} />}
            {hasReadme && <MetadataBadge type="readme" value="README" />}
          </div>
        </div>
        {!hasOwner && (
          <div className="ml-4 flex-shrink-0">
            <OwnerStatusBadge />
          </div>
        )}
      </div>
    </div>
  );
}
