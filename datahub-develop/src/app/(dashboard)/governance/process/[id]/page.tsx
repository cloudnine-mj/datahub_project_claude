"use client";

import { useParams } from "next/navigation";
import { PostDetailView } from "@/components/governance/PostDetailView";
import { PostNewView } from "@/components/governance/PostNewView";

export default function Page() {
  const params = useParams();
  const id = params?.id as string;
  // 정적 segment `new/page.tsx` 가 빌드 결과에서 누락된 환경에서도 작성 화면이
  // 뜨도록 동적 [id] 라우트에서 id="new" 를 직접 처리.
  if (id === "new") return <PostNewView board="process" />;
  return <PostDetailView board="process" postId={id as unknown as number} />;
}
