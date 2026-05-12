"use client";

// 내 문서 목록 —
//   admin: 본인이 작성한 정책/프로세스 게시글 (공개 + 임시저장)
//   non-admin: 본인이 제출한 신청서 목록
// role 에 따라 한쪽만 노출. admin 은 신청서를 작성할 일이 거의 없고, non-admin 은
// 정책/프로세스 글쓰기 권한 자체가 없으므로 양쪽 모두 한쪽만 의미 있음.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileEdit, Pencil } from "lucide-react";
import {
  api,
  type BoardType,
  type FormListItem,
  type FormStatus,
  type Me,
  type PostListItem,
} from "@/lib/api";
import { Breadcrumb } from "@/components/Breadcrumb";
import { DeleteFormButton } from "@/components/DeleteFormButton";
import { DeletePostButton } from "@/components/DeletePostButton";
import { StatusBadge, STATUSES } from "@/components/StatusBadge";
import { boardSegment } from "@/components/BoardListView";
import { BOARD_LABELS, FORM_TYPE_LABELS, formatDateTime, parseUtc } from "@/lib/utils";

type StatusFilter = "all" | FormStatus;
type MyPost = PostListItem & { board: BoardType };

/** '-vN' 접미사를 제거한 base request_no. 그룹 키로 사용. */
function getBaseRequestNo(rn: string): string {
  return rn.replace(/-v\d+$/, "");
}

/** 그룹 내 '가장 최신 버전' 판정. 상태 확정도 우선, 동률이면 시각 역순. */
function statusPriority(status: string): number {
  if (status === "approved" || status === "rejected") return 4;
  if (status === "reviewing") return 3;
  if (status === "submitted") return 2;
  return 1; // draft
}

export default function MyDocumentsPage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
  }, []);

  // me 응답을 기다리는 동안 페이지 헤더만 노출 — 깜빡임 최소화
  if (!me) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "내 문서 목록" }]} />
        <h1 className="text-3xl font-bold tracking-tight">내 문서 목록</h1>
        <p className="mt-1.5 text-sm text-gray-500">불러오는 중...</p>
      </div>
    );
  }

  return me.user.role === "admin" ? <AdminPostsView /> : <UserFormsView />;
}

// ── admin: 본인 게시글 ─────────────────────────────────────────────────

function AdminPostsView() {
  const [posts, setPosts] = useState<MyPost[] | null>(null);

  const refetch = useCallback(() => {
    Promise.all([api.listMyPosts("policy"), api.listMyPosts("process")])
      .then(([policy, process]) => {
        const merged: MyPost[] = [
          ...policy.map((p) => ({ ...p, board: "policy" as BoardType })),
          ...process.map((p) => ({ ...p, board: "process" as BoardType })),
        ];
        merged.sort(
          (a, b) => parseUtc(b.updated_at).getTime() - parseUtc(a.updated_at).getTime(),
        );
        setPosts(merged);
      })
      .catch(() => setPosts([]));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const draftCount = posts?.filter((p) => p.is_draft).length ?? 0;

  return (
    <div>
      <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "내 문서 목록" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">내 문서 목록</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            작성한 정책 / 프로세스 게시글을 확인하고 이어서 작성하거나 삭제할 수 있습니다.
          </p>
        </div>
      </div>

      <section className="mt-6">
        <div className="flex items-center gap-2">
          <FileEdit size={16} className="text-gray-500" />
          <h2 className="text-base font-bold tracking-tight">내가 작성한 게시글</h2>
          <span className="text-xs text-gray-400">
            {posts === null ? "..." : `${posts.length}건 (임시저장 ${draftCount}건)`}
          </span>
        </div>

        <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="w-48 px-6 py-3 font-medium">게시판</th>
                <th className="px-6 py-3 font-medium">제목</th>
                <th className="w-28 px-6 py-3 font-medium">상태</th>
                <th className="w-44 px-6 py-3 font-medium">최근 수정</th>
                <th className="w-56 px-6 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {posts === null ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
                </tr>
              ) : posts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    작성한 게시글이 없습니다.
                  </td>
                </tr>
              ) : (
                posts.map((p) => (
                  <tr key={`${p.board}-${p.id}`} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-600">{BOARD_LABELS[p.board]}</td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/governance/${boardSegment(p.board)}/${p.id}`}
                        className="font-medium hover:text-brand"
                      >
                        {p.title || <span className="italic text-gray-400">(제목 없음)</span>}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <PostStatusBadge post={p} />
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDateTime(p.updated_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <Link
                          href={`/governance/${boardSegment(p.board)}/new?id=${p.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600"
                        >
                          <Pencil size={12} /> 수정
                        </Link>
                        <DeletePostButton board={p.board} postId={p.id} onDeleted={refetch} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PostStatusBadge({ post }: { post: MyPost }) {
  if (post.is_draft) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
        임시저장
      </span>
    );
  }
  if (post.visibility === "admin") {
    return (
      <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
        비공개
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
      게시됨
    </span>
  );
}

// ── 일반 사용자: 본인 신청서 ────────────────────────────────────────────

function UserFormsView() {
  const [items, setItems] = useState<FormListItem[] | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const refetch = useCallback(() => {
    api.listForms({ mine: true }).then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // 다른 탭에서 수정 후 돌아오거나 브라우저 포커스 복원 시 자동 새로고침 — Router Cache 안전망.
  useEffect(() => {
    function onFocus() {
      refetch();
    }
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refetch]);

  // base request_no 별 그룹핑 → 그룹당 최신 1개만 메인에 노출.
  const latestItems = useMemo(() => {
    if (!items) return null;
    const byBase = new Map<string, FormListItem[]>();
    for (const it of items) {
      const base = getBaseRequestNo(it.request_no);
      const arr = byBase.get(base) ?? [];
      arr.push(it);
      byBase.set(base, arr);
    }
    const latest: FormListItem[] = [];
    for (const [, group] of byBase) {
      group.sort((a, b) => {
        const dp = statusPriority(b.status) - statusPriority(a.status);
        if (dp !== 0) return dp;
        return parseUtc(b.submitted_at).getTime() - parseUtc(a.submitted_at).getTime();
      });
      latest.push(group[0]);
    }
    latest.sort(
      (a, b) => parseUtc(b.submitted_at).getTime() - parseUtc(a.submitted_at).getTime(),
    );
    return latest;
  }, [items]);

  const filtered = useMemo(() => {
    if (!latestItems) return null;
    return filter === "all" ? latestItems : latestItems.filter((it) => it.status === filter);
  }, [latestItems, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: latestItems?.length ?? 0 };
    for (const it of latestItems ?? []) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [latestItems]);

  return (
    <div>
      <Breadcrumb items={[{ label: "Governance", href: "/governance" }, { label: "내 문서 목록" }]} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">내 문서 목록</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            프로젝트명을 클릭하면 신청서 상세를 확인하고 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-white p-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            전체 {counts.all > 0 && <span className="ml-1 text-gray-400">({counts.all})</span>}
          </FilterChip>
          {STATUSES.filter((s) => s.value !== "rejected").map((s) => (
            <FilterChip
              key={s.value}
              active={filter === s.value}
              onClick={() => setFilter(s.value)}
            >
              {s.label}
              {(counts[s.value] ?? 0) > 0 && (
                <span className="ml-1 text-gray-400">({counts[s.value]})</span>
              )}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-6 py-3 font-medium">신청서 종류</th>
              <th className="px-6 py-3 font-medium">프로젝트명</th>
              <th className="w-28 px-6 py-3 font-medium">상태</th>
              <th className="w-44 px-6 py-3 font-medium">제출일</th>
              <th className="w-40 px-6 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered === null ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">불러오는 중...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  {latestItems && latestItems.length > 0
                    ? "선택한 상태의 신청서가 없습니다."
                    : "제출한 신청서가 없습니다."}
                </td>
              </tr>
            ) : (
              filtered.map((it) => (
                <tr key={it.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">{FORM_TYPE_LABELS[it.form_type]}</td>
                  <td className="px-6 py-4">
                    <Link href={`/governance/forms/detail/${it.id}?from=my`} className="block hover:text-brand">
                      <div className="font-semibold">{it.project_name}</div>
                      <div className="text-xs text-gray-400">{it.request_no}</div>
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={it.status} />
                  </td>
                  <td className="px-6 py-4 text-gray-500">{formatDateTime(it.submitted_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={api.exportFormUrl(it.id)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        <Download size={12} /> Excel
                      </a>
                      <DeleteFormButton
                        formId={it.id}
                        contextLabel={it.project_name}
                        onDeleted={refetch}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterChip({
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
        "rounded px-3 py-1.5 text-xs font-semibold transition " +
        (active ? "bg-brand text-white" : "text-gray-600 hover:bg-gray-100")
      }
    >
      {children}
    </button>
  );
}
