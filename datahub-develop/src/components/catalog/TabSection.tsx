"use client";

import { useState, useEffect } from "react";
import CodeBlock from "./CodeBlock";
import FileTree from "./FileTree";
import DataPreviewTable from "./DataPreviewTable";
import CommitTimeline from "./CommitTimeline";
import DataCardTab from "./DataCardTab";

type TabId = "readme" | "files" | "history" | "usage";

interface TabSectionProps {
  tableName: string;
  fullName: string;
  catalogName: string;
  description?: string | null;
  /** group namespace for group-scoped BFF routes. When provided, BFF calls use
   *  `/api/catalog/lakefs/${group}/${repoName}/...` instead of the bare repo path. */
  group?: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "readme", label: "데이터 카드" },
  { id: "files", label: "파일" },
  { id: "history", label: "버전 기록" },
  { id: "usage", label: "활용하기" },
];

export default function TabSection({
  tableName,
  fullName,
  catalogName,
  description,
  group,
}: TabSectionProps) {
  const [activeTab, setActiveTab] = useState<TabId>("readme");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState("main");
  const [branches, setBranches] = useState<{ id: string }[]>([]);

  // 1:1 매핑: table_name (underscored) -> repo name (hyphenated)
  const bareRepoName = tableName.replace(/_/g, "-");
  // Compose group/repo path when group is available (group-scoped BFF routes)
  const repoName = group ? `${group}/${bareRepoName}` : bareRepoName;

  useEffect(() => {
    fetch(`/api/catalog/lakefs/${repoName}/branches`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBranches(data))
      .catch(() => {});
  }, [repoName]);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  return (
    <div className="mt-8">
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex gap-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-teal-600 border-b-2 border-teal-600"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {branches.length > 0 && (
            <div className="flex items-center gap-2 pr-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <select
                value={selectedRef}
                onChange={(e) => {
                  setSelectedRef(e.target.value);
                  setSelectedFile(null);
                }}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 text-gray-700 bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg p-8">
        {activeTab === "readme" && (
          <DataCardTab repoName={repoName} branch={selectedRef} />
        )}

        {activeTab === "files" && (
          <div>
            <FileTree
              repoName={repoName}
              prefix=""
              branch={selectedRef}
              onFileClick={handleFileSelect}
            />
            {selectedFile && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <DataPreviewTable
                  repoName={repoName}
                  filePath={selectedFile}
                  branch={selectedRef}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <CommitTimeline repoName={repoName} branch={selectedRef} />
        )}

        {activeTab === "usage" && (
          <div className="max-w-none">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              설치
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              GCP 인증이 설정되어 있어야 합니다. (<code className="text-xs bg-gray-200 px-1 py-0.5 rounded">gcloud auth login</code>)
            </p>

            <CodeBlock
              title="SDK 설치"
              code={`uv pip install datahub --upgrade \\
  --extra-index-url https://oauth2accesstoken:$(gcloud auth print-access-token)@us-central1-python.pkg.dev/lgair-futurecast/python-packages/simple/ \\
  --native-tls`}
            />

            <h3 className="text-lg font-semibold text-gray-800 mt-8 mb-1">
              Python SDK
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">datahub.DataClient</code>로 데이터를 검색, 다운로드, 업로드할 수 있습니다.
            </p>

            <CodeBlock
              title="다운로드"
              code={`from datahub import DataClient

client = DataClient()

# 전체 데이터셋 다운로드
client.download("${repoName}", "/", "./data/${tableName}/")

# 특정 경로만 다운로드
client.download("${repoName}", "train/", "./data/train/", branch="main")`}
            />

            <CodeBlock
              title="업로드"
              code={`from datahub import DataClient

client = DataClient()

# 로컬 파일/디렉터리 업로드
client.upload("${repoName}", "./output/", branch="main", message="Add processed data")`}
            />

            <CodeBlock
              title="파일 탐색"
              code={`from datahub import DataClient

client = DataClient()

# 파일 목록 조회
result = client.ls("${repoName}", recursive=True)
for path in result.items:
    print(path)`}
            />

            <CodeBlock
              title="메타데이터 조회 및 검색"
              code={`from datahub import DataClient

client = DataClient()

# 테이블 메타데이터 조회
table = client.get_table("${fullName}")
print(table.comment)       # 설명
print(table.properties)    # 전체 메타데이터

# 키워드로 검색
results = client.search("${tableName}")

# 필터로 검색
results = client.search("", filters={"modality": "Text", "task": "QA"})`}
            />

            <CodeBlock
              title="HuggingFace Dataset 연동"
              code={`from datahub import DataClient

client = DataClient()

# HuggingFace Dataset으로 로드
ds = client.load("${tableName}")

# HuggingFace Dataset 업로드
client.push(ds, "${tableName}", message="Update dataset")`}
            />

            <CodeBlock
              title="버전 관리"
              code={`from datahub import DataClient

client = DataClient()

# 브랜치 생성 → 업로드 → 머지
client.create_branch("${repoName}", "exp-v2", source="main")
client.upload("${repoName}", "./data/", branch="exp-v2", message="Experimental data")
client.merge("${repoName}", "exp-v2", into="main")`}
            />

            <h3 className="text-lg font-semibold text-gray-800 mt-8 mb-1">
              CLI
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">datahub</code> 명령어로 터미널에서 직접 데이터에 접근할 수 있습니다.
            </p>

            <CodeBlock
              title="데이터 다운로드 / 업로드"
              code={`# 다운로드
datahub cp dh://${repoName}/ ./data/${tableName}/ -b main

# 업로드
datahub cp ./output/ dh://${repoName}/ -b main -m "Add processed data"`}
            />

            <CodeBlock
              title="파일 탐색 및 미리보기"
              code={`# 파일 목록 (재귀)
datahub ls dh://${repoName}/ -b main -r

# 파일 내용 출력
datahub cat dh://${repoName}/data.json -b main | head -5`}
            />

            <CodeBlock
              title="메타데이터 조회 및 검색"
              code={`# 메타데이터 조회
datahub catalog get ${fullName}

# JSON 출력
datahub -j catalog get ${fullName} | jq .properties

# 데이터셋 검색
datahub search "${tableName}"
datahub search --modality Text --task QA`}
            />

            <CodeBlock
              title="메타데이터 수정"
              code={`datahub catalog update ${fullName} \\
  --owner user@lgresearch.ai \\
  --modality Text \\
  --task QA \\
  --scan-tier "Tier 1"`}
            />

            <CodeBlock
              title="버전 관리"
              code={`# 브랜치 생성 → 업로드 → 머지
datahub branch create ${repoName} exp-v2
datahub cp ./data/ dh://${repoName}/ -b exp-v2 -m "Experimental data"
datahub merge ${repoName} exp-v2 --into main

# 브랜치 목록
datahub branch list ${repoName}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
