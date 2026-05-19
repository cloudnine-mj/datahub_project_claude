/**
 * 데이터 거버넌스 정책 게시판 — 정책 전용 PolicyBoardView 사용.
 * 컬럼: 관리 번호 / 정책명 / 작성자 / 등록일 / 수정일 / 태그.
 * admin 만 '작성하기' 버튼 노출.
 */
import { PolicyBoardView } from "@/components/governance/PolicyBoardView";

export default function Page() {
  return <PolicyBoardView />;
}
