import { PostDetailView } from "@/components/PostDetailView";
export default function Page({ params }: { params: { id: string } }) {
  return <PostDetailView board="production_process" postId={Number(params.id)} />;
}
