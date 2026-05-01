// 화면 10: 신청서 작성 폼 — 모든 5종을 [type] 동적 라우트로 처리.
import { notFound } from "next/navigation";
import { FormBuilder } from "@/components/FormBuilder";
import { FORM_SCHEMAS } from "@/lib/formSchemas";
import type { FormType } from "@/lib/api";

export default function Page({ params }: { params: { type: string } }) {
  const t = params.type as FormType;
  if (!(t in FORM_SCHEMAS)) notFound();
  return <FormBuilder formType={t} />;
}
