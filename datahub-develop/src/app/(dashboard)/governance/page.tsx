// 거버넌스 진입 — 실 데이터 기반 요청 목록으로 리다이렉트.
// 기존 storyboard mock 페이지는 제거됨 (Phase 7).
import { redirect } from "next/navigation";

export default function GovernanceRoot() {
  redirect("/governance/forms/list");
}
