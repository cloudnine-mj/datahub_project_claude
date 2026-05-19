/**
 * 데이터 제작 / 활용 요청 프로세스 게시판 — datahub-web `/governance/process` 포팅.
 *
 * 태그는 사용자 요청으로 제거됨 (board-list 가 board prop 으로 분기).
 */

import { BoardList } from "@/components/governance/posts/board-list";

export default function Page() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-text-primary">
          데이터 제작 / 활용 요청 프로세스
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          제작/활용 요청 절차 가이드 문서를 확인합니다.
        </p>
      </header>
      <BoardList board="process" />
    </div>
  );
}
