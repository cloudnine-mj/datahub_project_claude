"use client";

import { useState } from "react";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MOCK_COLUMNS = ["id", "question", "answer", "category", "difficulty"];
const MOCK_ROWS = [
  ["1", "서울의 인구는?", "약 960만 명 (2024년 기준)", "지리", "쉬움"],
  ["2", "LG의 창립연도는?", "1958년 (락희화학공업사)", "기업", "보통"],
  ["3", "광합성이란 무엇인가?", "식물이 빛 에너지를 이용해 CO₂와 H₂O로부터 유기물을 합성하는 과정", "과학", "어려움"],
  ["4", "대한민국 국보 1호는?", "숭례문 (남대문)", "문화", "쉬움"],
  ["5", "DNA의 이중 나선 구조는 누가 발견했는가?", "왓슨과 크릭 (1953년)", "과학", "보통"],
  ["6", "삼성전자의 설립 연도는?", "1969년", "기업", "보통"],
  ["7", "한반도의 총 면적은?", "약 22만 km²", "지리", "보통"],
  ["8", "태양계에서 가장 큰 행성은?", "목성 (Jupiter)", "과학", "쉬움"],
];

const DEFAULT_QUERY = `SELECT id, question, category, difficulty
FROM train
WHERE difficulty = '쉬움'
LIMIT 10`;

export default function DataExplorerPage() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [hasResults, setHasResults] = useState(false);
  const [page, setPage] = useState(1);
  const totalPages = 5;

  const handleRun = () => {
    setHasResults(true);
  };

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col gap-4">
      {/* Query Editor */}
      <div className="rounded-xl border border-dh-border overflow-hidden">
        <div className="bg-bg-surface px-4 py-2.5 border-b border-dh-border flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">SQL Query</span>
          <Button
            size="sm"
            className="h-7 gap-1.5 bg-brand hover:bg-brand/90 text-white text-xs"
            onClick={handleRun}
          >
            <Play className="h-3 w-3" />
            Run
          </Button>
        </div>
        <Textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-h-[120px] resize-none rounded-none border-0 font-mono text-sm focus-visible:ring-0 bg-bg-code"
          placeholder="SELECT * FROM train LIMIT 10"
        />
      </div>

      {/* Results Table */}
      <div className="flex-1 rounded-xl border border-dh-border overflow-hidden flex flex-col">
        <div className="bg-bg-surface px-4 py-2.5 border-b border-dh-border flex items-center justify-between shrink-0">
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {hasResults ? `Results — ${MOCK_ROWS.length} rows` : "Results"}
          </span>
          {hasResults && (
            <span className="text-xs text-text-muted">query took 0.12s</span>
          )}
        </div>

        {!hasResults ? (
          <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
            쿼리를 실행하면 결과가 여기에 표시됩니다.
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 border-b border-dh-border bg-bg-surface">
                  <tr>
                    {MOCK_COLUMNS.map((col) => (
                      <th key={col} className="px-4 py-2.5 text-left font-medium text-text-secondary whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dh-border">
                  {MOCK_ROWS.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-bg-surface"}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2.5 text-text-primary max-w-[240px] truncate">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="shrink-0 flex items-center justify-between border-t border-dh-border px-4 py-2.5 bg-bg-surface">
              <span className="text-xs text-text-muted">페이지 {page} / {totalPages}</span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
