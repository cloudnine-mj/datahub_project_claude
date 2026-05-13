// 정책 / 프로세스 안내 — '데이터 관리 정책' + '데이터 제작 / 활용 요청 프로세스' 를 한 페이지에 위/아래로 쌓아 노출.
// 두 보드의 데이터 모델은 분리 유지 (정책: 중요도·태그 / 프로세스: 카테고리·유형). 각각 compact 모드로 임베드.

import { Info } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BoardListView } from "@/components/BoardListView";
import { PolicyBoardView } from "@/components/PolicyBoardView";

export default function GovernanceInfoPage() {
  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "정책 / 프로세스 안내" },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">정책 / 프로세스 안내</h1>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-4">
        <div className="flex items-start gap-3 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <p className="text-blue-800/80">
            데이터 관리에 필요한 <strong className="font-semibold">정책</strong> 과 데이터 제작·활용을 위한{" "}
            <strong className="font-semibold">프로세스 / 가이드</strong> 를 한 곳에서 확인합니다.
          </p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold tracking-tight">데이터 관리 정책</h2>
        <PolicyBoardView compact />
      </section>

      <section className="mt-12">
        <h2 className="mb-3 text-xl font-bold tracking-tight">데이터 제작 / 활용 요청 프로세스</h2>
        <BoardListView board="process" compact />
      </section>
    </div>
  );
}
