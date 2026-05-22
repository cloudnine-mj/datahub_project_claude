"use client";

import { useParams } from "next/navigation";
import { PolicyDetailView } from "@/components/governance/PolicyDetailView";
import { PostNewView } from "@/components/governance/PostNewView";

export default function Page() {
  const params = useParams();
  const id = params?.id as string;
  // 정적 segment `new/page.tsx` 가 빌드 결과에서 누락된 환경에서도 작성 화면이
  // 뜨도록 동적 [id] 라우트에서 id="new" 를 직접 처리.
  if (id === "new") return <PostNewView board="policy" />;
  // PolicyDetailView 는 number postId 를 받지만 string cuid 도 그대로 fetch 에 사용 가능.
  return <PolicyDetailView postId={id as unknown as number} />;
}
