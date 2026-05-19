"use client";

import { useState, useCallback, useEffect } from "react";
import SearchBar from "@/components/catalog/SearchBar";
import FilterBar from "@/components/catalog/FilterBar";
import DatasetCard from "@/components/catalog/DatasetCard";
import type { TableInfo, SearchParams, FilterOptions } from "@/lib/platform-client";

export default function DataCardsPage() {
  const [keyword, setKeyword] = useState("");
  const [searchParams, setSearchParams] = useState<SearchParams>({});
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    modalities: [],
    tasks: [],
    organizations: [],
    data_card_tiers: [],
  });
  const [datasets, setDatasets] = useState<TableInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch filter options
  useEffect(() => {
    fetch("/api/catalog/filters")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setFilterOptions(data);
      })
      .catch(() => {});
  }, []);

  // Fetch datasets
  useEffect(() => {
    setIsLoading(true);
    const sp = new URLSearchParams();
    if (searchParams.keyword) sp.set("keyword", searchParams.keyword);
    if (searchParams.modality) sp.set("modality", searchParams.modality);
    if (searchParams.task) sp.set("task", searchParams.task);
    if (searchParams.organization) sp.set("organization", searchParams.organization);
    if (searchParams.data_card_tier) sp.set("data_card_tier", searchParams.data_card_tier);

    fetch(`/api/catalog/datasets?${sp}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDatasets(Array.isArray(data) ? data : []))
      .catch(() => setDatasets([]))
      .finally(() => setIsLoading(false));
  }, [searchParams]);

  const handleSearch = useCallback(() => {
    setSearchParams((prev) => ({ ...prev, keyword: keyword || undefined }));
  }, [keyword]);

  const handleFilterChange = useCallback(
    (key: keyof SearchParams, value: string) => {
      setSearchParams((prev) => ({
        ...prev,
        [key]: value || undefined,
      }));
    },
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">데이터 카탈로그</h1>
        <p className="text-gray-500">데이터셋을 검색하고 관리합니다.</p>
      </div>

      <SearchBar value={keyword} onChange={setKeyword} onSearch={handleSearch} />
      <FilterBar
        filters={searchParams}
        filterOptions={filterOptions}
        onChange={handleFilterChange}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          검색 결과 <span className="font-semibold">{datasets.length}개</span>
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            데이터셋 목록을 불러오는 중...
          </div>
        ) : datasets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            검색 결과가 없습니다.
          </div>
        ) : (
          datasets.map((table) => (
            <DatasetCard key={table.full_name} table={table} />
          ))
        )}
      </div>
    </div>
  );
}
