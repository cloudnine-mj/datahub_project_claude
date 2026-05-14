// 데이터 도입 유형 카드 데이터 — '1. 기획 > 신청서 작성' 화면에서 사용.
// 시각 디자인은 ApplicationTypeCard 가 처리하고 여기서는 데이터만 정의.

import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Calendar,
  Coins,
  FileCheck,
  RefreshCw,
  ShoppingCart,
  User,
  Wrench,
} from "lucide-react";

export interface MetaItem {
  icon: LucideIcon;
  label: string;
  value: string;
}

export interface ApplicationType {
  /** 라우팅용 form type 식별자 — 기존 FormBuilder 경로와 일치 */
  type: "data_production" | "data_purchase" | "data_subscription";
  icon: LucideIcon;
  /** Tailwind 클래스 — 아이콘 박스 배경 */
  iconBgClass: string;
  /** Tailwind 클래스 — 아이콘 자체 색 */
  iconColorClass: string;
  title: string;
  description: string;
  metaItems: MetaItem[];
  examples: string;
}

export const APPLICATION_TYPES: ApplicationType[] = [
  {
    type: "data_production",
    icon: Wrench,
    iconBgClass: "bg-[#FAECE7] dark:bg-[#3a1c12]",
    iconColorClass: "text-[#993C1D] dark:text-[#e8a896]",
    title: "데이터 용역 제작",
    description: "외부 업체에 신규 데이터 제작을 의뢰",
    metaItems: [
      { icon: Coins, label: "규모", value: "1,000만원 이상" },
      { icon: Calendar, label: "리드타임", value: "착수 3주 전" },
      { icon: User, label: "담당", value: "김은솔 (Data Gov.)" },
    ],
    examples: "예) 의료 영상 어노테이션, 음성 데이터 수집·라벨링",
  },
  {
    type: "data_purchase",
    icon: ShoppingCart,
    iconBgClass: "bg-[#E6F1FB] dark:bg-[#0e2a44]",
    iconColorClass: "text-[#185FA5] dark:text-[#7fb6e6]",
    title: "데이터 구매",
    description: "기존 데이터셋을 일회성으로 구매",
    metaItems: [
      { icon: Coins, label: "결제", value: "1회성" },
      { icon: FileCheck, label: "필요사항", value: "라이선스·활용범위" },
      { icon: User, label: "담당", value: "박용민 (AI Biz.)" },
    ],
    examples: "예) 공개 코퍼스 라이선스 구매, 이미지 데이터셋 일괄 구매",
  },
  {
    type: "data_subscription",
    icon: RefreshCw,
    iconBgClass: "bg-[#E1F5EE] dark:bg-[#0d3328]",
    iconColorClass: "text-[#0F6E56] dark:text-[#7fc9b3]",
    title: "데이터 구독",
    description: "정기 갱신 데이터를 기간 단위로 구독",
    metaItems: [
      { icon: Coins, label: "결제", value: "월·연 정기" },
      { icon: Bell, label: "필요사항", value: "갱신 주기·만료 관리" },
      { icon: User, label: "담당", value: "박용민 (AI Biz.)" },
    ],
    examples: "예) 뉴스 코퍼스 월간 피드, 금융 데이터 API 구독",
  },
];
