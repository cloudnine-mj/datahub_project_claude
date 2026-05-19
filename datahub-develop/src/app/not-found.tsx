import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-surface text-center px-4">
      <p className="font-heading text-[80px] font-bold text-dh-border leading-none">404</p>
      <h1 className="mt-4 font-heading text-2xl font-semibold text-text-primary">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="mt-2 text-sm text-text-secondary max-w-sm">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <div className="mt-8 flex gap-3">
        <Button asChild className="bg-brand hover:bg-brand/90 text-white">
          <Link href="/">홈으로 이동</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/explore">탐색하기</Link>
        </Button>
      </div>
    </div>
  );
}
