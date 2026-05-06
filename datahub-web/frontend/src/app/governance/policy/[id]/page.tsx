// 화면 4 (사용자 여정 Step 4): 정책 상세 — 핵심 요약 + 체크리스트 + 예시.
import { PolicyDetailView } from "@/components/PolicyDetailView";

export default function Page({ params }: { params: { id: string } }) {
  return <PolicyDetailView postId={Number(params.id)} />;
}
