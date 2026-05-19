/**
 * 데이터 관리 정책 게시판 — datahub-web `/governance/policy` 포팅.
 * 정책 보드는 태그 / severity 같은 메타필드 사용.
 */

import { BoardList } from "@/components/governance/posts/board-list";

export default function Page() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-text-primary">
          데이터 관리 정책
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          정책·가이드라인 문서를 확인합니다.
        </p>
      </header>
      <BoardList board="policy" />
    </div>
  );
}
