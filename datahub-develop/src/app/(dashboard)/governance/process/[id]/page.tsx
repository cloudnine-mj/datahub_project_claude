"use client";

import { useParams } from "next/navigation";
import { PostDetailView } from "@/components/governance/PostDetailView";

export default function Page() {
  const params = useParams();
  const id = params?.id as string;
  return <PostDetailView board="process" postId={id as unknown as number} />;
}
