import { PostDetailView } from "@/components/PostDetailView";
export default function Page({ params }: { params: { id: string } }) {
  return <PostDetailView board="policy" postId={Number(params.id)} />;
}
