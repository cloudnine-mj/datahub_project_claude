"use client";

import { useState, useCallback } from "react";
import { CloudUpload, X, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface QueuedFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
}

export default function DataUploadPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [commitMessage, setCommitMessage] = useState("");
  const [branch, setBranch] = useState("main");

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: QueuedFile[] = Array.from(files).map((file) => ({
      id: `${file.name}-${Date.now()}`,
      file,
      status: "pending",
      progress: 0,
    }));
    setQueue((prev) => [...prev, ...newFiles]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const removeFile = (id: string) => {
    setQueue((prev) => prev.filter((f) => f.id !== id));
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-text-primary">Upload Files</h2>
        <p className="text-sm text-text-secondary mt-0.5">파일을 업로드하고 커밋 메시지를 입력하세요.</p>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 px-6 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-brand bg-red-50"
            : "border-dh-border hover:border-brand/50 hover:bg-bg-surface"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <CloudUpload className={`h-10 w-10 mb-3 ${isDragging ? "text-brand" : "text-text-muted"}`} />
        <p className="font-medium text-sm text-text-primary">
          파일을 드래그하거나 <span className="text-brand">클릭하여 선택</span>
        </p>
        <p className="text-xs text-text-muted mt-1">
          Parquet, CSV, JSON, 이미지 등 지원 · 최대 5GB
        </p>
      </div>

      {/* Upload Queue */}
      {queue.length > 0 && (
        <div className="rounded-xl border border-dh-border overflow-hidden">
          <div className="bg-bg-surface px-4 py-2.5 border-b border-dh-border">
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              파일 목록 ({queue.length})
            </span>
          </div>
          <div className="divide-y divide-dh-border">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-text-muted" />
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{item.file.name}</span>
                <span className="text-xs text-text-muted">{formatBytes(item.file.size)}</span>
                {item.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-accent-green" />
                ) : (
                  <button
                    onClick={() => removeFile(item.id)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="branch" className="text-sm font-medium text-text-primary">Target Branch</Label>
          <Input
            id="branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="commit-message" className="text-sm font-medium text-text-primary">
            Commit Message <span className="text-brand">*</span>
          </Label>
          <Textarea
            id="commit-message"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="예: feat: train 데이터 추가 (10,000건)"
            rows={3}
            className="text-sm resize-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {/* TODO: connect to Presigned URL flow — POST /api/repos/:group/:repo/upload */}
        <Button
          className="bg-brand hover:bg-brand/90 text-white"
          disabled={queue.length === 0 || !commitMessage.trim()}
        >
          Upload & Commit
        </Button>
        {/* TODO: navigate back to browser on cancel */}
        <Button variant="outline" disabled>Cancel</Button>
      </div>
    </div>
  );
}
