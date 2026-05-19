import type { TableInfo } from "./platform-client";

// ── Types ───────────────────────────────────────────

/** 데이터셋 메타데이터 — catalog.py DatasetMetadata 미러링. */
export interface DatasetMetadata {
  dataset_name?: string | null;
  dataset_description?: string | null;
  project?: string | null;
  organization?: string | null;
  owner?: string | null;
  modality?: string | null;
  task?: string | null;
  data_count?: string | null;
  data_size?: string | null;
  license?: string | null;
  storage_location?: string | null;
  version?: string | null;
  tags?: string | null;
  updated_at?: string | null;
  data_card_tier?: string | null;
}

/** properties dict에서 사용하는 필드 이름들 (dataset_description, dataset_name, storage_location 제외). */
export const PROPERTY_FIELDS = [
  "project",
  "organization",
  "owner",
  "modality",
  "task",
  "data_count",
  "data_size",
  "license",
  "version",
  "tags",
  "updated_at",
  "data_card_tier",
] as const;

/** UC 응답 → DatasetMetadata 변환. */
export function tableInfoToMetadata(t: TableInfo): DatasetMetadata {
  const props = t.properties || {};
  const meta: DatasetMetadata = {
    dataset_name: t.table_name || null,
    dataset_description: t.comment || null,
    storage_location: t.storage_location || null,
  };
  for (const f of PROPERTY_FIELDS) {
    if (f in props) {
      (meta as Record<string, string | null>)[f] = props[f];
    }
  }
  return meta;
}

// ── LakeFS Types ────────────────────────────────────

/** LakeFS object listing entry. */
export interface LakeFSObject {
  path: string;
  path_type: "object" | "common_prefix";
  size_bytes?: number;
  mtime?: number;
  checksum?: string;
}

/** Nested file-tree node built from flat LakeFS listing. */
export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  children?: FileTreeNode[];
}

/** Parsed data preview returned by the preview API. */
export interface DataPreview {
  format: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows?: number;
  truncated: boolean;
  filePath: string;
}

/** Normalised commit info for the UI timeline. */
export interface CommitInfo {
  id: string;
  shortId: string;
  message: string;
  userEmail?: string;
  date: string;
  isMerge: boolean;
  parents: string[];
}

/** Branch info returned by the branches proxy API. */
export interface BranchInfo {
  id: string;
  commit_id: string;
  commit_message: string;
  commit_date: number;
}

/** Diff entry returned by the diff proxy API. */
export interface DiffEntryInfo {
  path: string;
  change_type: "added" | "removed" | "changed";
  path_type: string;
  size_bytes: number | null;
}

/** Lineage graph node. */
export interface LineageNode {
  repo_name: string;
  owner: string;
  visibility: string;
}

/** Lineage graph edge. */
export interface LineageEdge {
  source: string;
  target: string;
  relation_type: string;
}

// ── Constants ───────────────────────────────────────

/** 메타데이터 필드 → 한국어 라벨 매핑. */
export const METADATA_LABELS: Record<string, string> = {
  dataset_name: "데이터셋 이름",
  dataset_description: "데이터셋 설명",
  project: "관련 프로젝트",
  organization: "소속 (Lab/Tech Cell)",
  owner: "데이터 담당자/책임자",
  modality: "Modality",
  task: "Task 정보",
  data_count: "데이터 수량",
  data_size: "데이터 Size",
  license: "License",
  storage_location: "적재 위치",
  version: "버전 정보",
  tags: "Tag",
  updated_at: "최종 수정일",
  data_card_tier: "Data Card Tier",
};

/** 상세 페이지 메타데이터 테이블 행 표시 순서. */
export const METADATA_FIELD_ORDER = [
  "dataset_name",
  "dataset_description",
  "project",
  "organization",
  "owner",
  "modality",
  "task",
  "data_count",
  "data_size",
  "license",
  "storage_location",
  "version",
  "tags",
  "updated_at",
  "data_card_tier",
] as const;

/** 모달리티 배지 색상. */
export const MODALITY_COLORS: Record<string, string> = {
  Text: "bg-emerald-100 text-emerald-800 border-emerald-300",
  Image: "bg-blue-100 text-blue-800 border-blue-300",
  "Speech/Audio": "bg-purple-100 text-purple-800 border-purple-300",
  Video: "bg-orange-100 text-orange-800 border-orange-300",
  Tabular: "bg-yellow-100 text-yellow-800 border-yellow-300",
};

/** 필터 드롭다운 한국어 라벨. */
export const FILTER_LABELS: Record<string, string> = {
  modality: "Modality",
  task: "Task 정보",
  organization: "소속",
  data_card_tier: "Data Card Tier",
};

// ── Utility Functions ───────────────────────────────

/** Format bytes to human-readable string (KB, MB, GB). */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

/** Build nested FileTreeNode[] from flat LakeFS object list. */
export function buildFileTree(
  objects: LakeFSObject[],
  basePath: string,
): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const dirMap = new Map<string, FileTreeNode>();

  const getOrCreateDir = (dirPath: string): FileTreeNode => {
    const existing = dirMap.get(dirPath);
    if (existing) return existing;

    const relative = dirPath.startsWith(basePath)
      ? dirPath.slice(basePath.length)
      : dirPath;
    const parts = relative.replace(/\/$/, "").split("/");
    const name = parts[parts.length - 1] || dirPath;

    const node: FileTreeNode = {
      name,
      path: dirPath,
      type: "directory",
      children: [],
    };
    dirMap.set(dirPath, node);

    const parentPath = dirPath
      .replace(/\/$/, "")
      .split("/")
      .slice(0, -1)
      .join("/");
    const parentDir = parentPath + "/";

    if (parentDir.length > basePath.length && parentDir !== dirPath) {
      const parent = getOrCreateDir(parentDir);
      parent.children!.push(node);
    } else {
      root.push(node);
    }

    return node;
  };

  for (const obj of objects) {
    if (obj.path_type === "common_prefix") {
      getOrCreateDir(obj.path);
      continue;
    }

    const relative = obj.path.startsWith(basePath)
      ? obj.path.slice(basePath.length)
      : obj.path;
    const parts = relative.split("/");
    const fileName = parts[parts.length - 1];

    const fileNode: FileTreeNode = {
      name: fileName,
      path: obj.path,
      type: "file",
      size: obj.size_bytes,
    };

    if (parts.length > 1) {
      const parentParts = obj.path.split("/").slice(0, -1);
      const parentDir = parentParts.join("/") + "/";
      const parent = getOrCreateDir(parentDir);
      parent.children!.push(fileNode);
    } else {
      root.push(fileNode);
    }
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const n of nodes) {
      if (n.children) sortNodes(n.children);
    }
  };
  sortNodes(root);

  return root;
}
