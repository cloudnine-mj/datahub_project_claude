/**
 * 데이터 거버넌스 정책 게시판 — datahub-web 원본 BoardListView 사용.
 * (PolicyBoardView 가 별도로 있는 경우엔 그쪽으로 전환 가능; 우선 통일.)
 */
import { BoardListView } from "@/components/governance/BoardListView";

export default function Page() {
  return <BoardListView board="policy" />;
}
