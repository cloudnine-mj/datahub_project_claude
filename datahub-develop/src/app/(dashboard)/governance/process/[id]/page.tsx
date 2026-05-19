import { PostDetail } from "@/components/governance/posts/post-detail";

export default function Page({ params }: { params: { id: string } }) {
  return <PostDetail board="process" id={params.id} />;
}
