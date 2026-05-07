import { notFound } from "next/navigation";
import { PolicyDetailView } from "@/components/PolicyDetailView";

export default function Page({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    notFound();
  }
  return <PolicyDetailView postId={id} />;
}
