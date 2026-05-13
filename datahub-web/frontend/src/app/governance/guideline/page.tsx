// 가이드라인 / 매뉴얼 — 아직 board 미구현. '준비 중' 안내만 노출.
// (사이드바 Variant A 미리보기용 stub. board 신설 시 PolicyBoardView 와 동일 패턴으로 교체 가능.)
import { Construction } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";

export default function GuidelinePage() {
  return (
    <div>
      <Breadcrumb
        items={[{ label: "Governance", href: "/governance" }, { label: "가이드라인 / 매뉴얼" }]}
      />
      <h1 className="text-3xl font-bold tracking-tight">가이드라인 / 매뉴얼</h1>
      <p className="mt-1.5 text-sm text-gray-500">
        업무 가이드라인·체크리스트·시스템 사용 매뉴얼을 모아두는 게시판.
      </p>

      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-6 py-16 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
          <Construction size={22} />
        </div>
        <h2 className="mt-4 text-base font-bold">준비 중</h2>
        <p className="mt-1.5 max-w-md text-sm text-gray-500">
          정책·프로세스에 따라 따라야 할 권장 절차와 매뉴얼을 정리한 게시판입니다.
          현재 사이드바 구조 미리보기로 추가된 자리표시 페이지이며, board 가
          확정되면 실제 글 목록으로 채워질 예정입니다.
        </p>
      </div>
    </div>
  );
}
