/**
 * 데이터 제작 / 활용 요청 프로세스 게시판 — datahub-web 원본 BoardListView 그대로.
 * 태그 컬럼은 사용자 요청으로 컴포넌트 내부에서 제거됨.
 */
import { BoardListView } from "@/components/governance/BoardListView";

export default function Page() {
  return <BoardListView board="process" />;
}
