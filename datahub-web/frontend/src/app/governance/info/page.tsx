"use client";

/**
 * 정책 / 프로세스 자료실 — '데이터 관리 정책' + '데이터 제작 / 요청 프로세스' 통합 진입점.
 *
 * 이 페이지는 데이터를 통합하지 않고 진입점만 통합한다. 탭 전환에 따라
 * 기존 PolicyBoardView / BoardListView 를 compact 모드로 재사용 — 각 도메인의
 * 고유 메타데이터(중요도·태그 vs 카테고리·유형)는 그대로 보존.
 *
 * URL 동기화: ?tab=policy|process (기본 policy). 탭 변경 시 history 에 푸시.
 */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Info } from "lucide-react";
import { Breadcrumb } from "@/components/Breadcrumb";
import { BoardListView } from "@/components/BoardListView";
import { PolicyBoardView } from "@/components/PolicyBoardView";

type Tab = "policy" | "process";

const TABS: { key: Tab; label: string; href: string }[] = [
  { key: "policy", label: "데이터 관리 정책", href: "/governance/info?tab=policy" },
  { key: "process", label: "데이터 제작 / 요청 프로세스", href: "/governance/info?tab=process" },
];

export default function GovernanceInfoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab");
  const active: Tab = tabParam === "process" ? "process" : "policy";

  function switchTab(t: Tab) {
    router.push(`/governance/info?tab=${t}`);
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Governance", href: "/governance" },
          { label: "정책 / 프로세스 자료실" },
        ]}
      />
      <h1 className="text-3xl font-bold tracking-tight">정책 / 프로세스 자료실</h1>

      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/60 px-5 py-4">
        <div className="flex items-start gap-3 text-sm">
          <Info size={18} className="mt-0.5 shrink-0 text-blue-600" />
          <p className="text-blue-800/80">
            데이터 관리에 필요한 <strong className="font-semibold">정책</strong> 과 데이터 제작·활용을 위한{" "}
            <strong className="font-semibold">프로세스 / 가이드</strong> 를 한 곳에서 확인합니다.
          </p>
        </div>
      </div>

      {/* 탭 — 단일 클릭 영역. Link 가 아니라 button 으로 history.push 만 사용해 깜빡임 최소화. */}
      <div className="mt-6 flex items-center gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={
              "relative -mb-px px-4 py-2.5 text-sm font-semibold transition " +
              (active === t.key
                ? "border-b-2 border-brand text-brand"
                : "border-b-2 border-transparent text-gray-500 hover:text-gray-800")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {active === "policy" ? (
          <PolicyBoardView compact />
        ) : (
          <BoardListView board="process" compact />
        )}
      </div>

      {/* 직접 진입 URL 도 그대로 유지 — 기존 deep link 호환용 보조 안내 */}
      <p className="mt-8 text-[11px] text-gray-400">
        직접 링크가 필요하면{" "}
        <Link href="/governance/policy" className="underline hover:text-gray-600">
          /governance/policy
        </Link>{" "}
        ·{" "}
        <Link href="/governance/process" className="underline hover:text-gray-600">
          /governance/process
        </Link>{" "}
        도 그대로 동작합니다.
      </p>
    </div>
  );
}
