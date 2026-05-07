import { notFound } from "next/navigation";
import { PostDetailView } from "@/components/PostDetailView";

export default function Page({ params }: { params: { id: string } }) {
  // 옛 URL (예: /governance/process/production) 이 [id] 에 잡혀 NaN 으로 fetch 되는 사고 방지
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  return <PostDetailView board="process" postId={id} />;
}
