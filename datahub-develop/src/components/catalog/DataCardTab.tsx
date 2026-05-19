"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DataCardTabProps {
  repoName: string;
  branch?: string;
}

export default function DataCardTab({ repoName, branch = "main" }: DataCardTabProps) {
  const [content, setContent] = useState("");
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchDataCard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/catalog/lakefs/${repoName}/datacard?ref=${branch}`,
      );
      if (res.ok) {
        const data = await res.json();
        setContent(data.content || "");
        setExists(data.exists);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [repoName, branch]);

  useEffect(() => {
    fetchDataCard();
  }, [fetchDataCard]);

  const handleAiGenerate = async () => {
    setAiLoading(true);
    try {
      const res = await fetch("/api/catalog/ai/datacard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoName, branch }),
      });

      if (res.ok) {
        const result = await res.json();
        setContent(result.generated || "");
        setExists(true);
        // 새로고침
        await fetchDataCard();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "AI 데이터카드 생성에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleEdit = () => {
    setDraft(content);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/catalog/lakefs/${repoName}/datacard`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: draft }),
        },
      );
      if (res.ok) {
        setContent(draft);
        setExists(true);
        setEditing(false);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "저장에 실패했습니다.");
      }
    } catch {
      alert("오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-sm">데이터 카드를 불러오는 중...</p>;
  }

  // 편집 모드
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">DATACARD.md 편집</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full h-[500px] p-4 text-sm font-mono border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 resize-y"
          placeholder="# 데이터 카드&#10;&#10;마크다운 형식으로 작성하세요..."
        />
      </div>
    );
  }

  // 읽기 모드
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-500">
          {exists ? "DATACARD.md" : ""}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleAiGenerate}
            disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {aiLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                생성 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI 채우기
              </>
            )}
          </button>
          <button
            onClick={handleEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            {exists ? "편집" : "작성"}
          </button>
        </div>
      </div>

      {exists && content ? (
        <div className="prose prose-sm max-w-none prose-headings:text-gray-800 prose-p:text-gray-600 prose-a:text-teal-600 prose-pre:bg-gray-800 prose-pre:text-gray-100 [&_:not(pre)>code]:bg-gray-100 [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:text-gray-800 [&_pre_code]:bg-transparent [&_pre_code]:text-inherit [&_pre_code]:p-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 text-sm">데이터 카드가 아직 작성되지 않았습니다.</p>
          <p className="text-gray-400 text-xs mt-1">
            &quot;작성&quot; 버튼을 눌러 DATACARD.md를 생성하세요.
          </p>
        </div>
      )}
    </div>
  );
}
