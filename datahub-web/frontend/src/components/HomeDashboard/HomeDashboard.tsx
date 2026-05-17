// '나의 현황' 대시보드 — Governance 홈 화면.
//   빠른 시작(6 타일) + 메인 grid(좌측 stack + 우측 사이드 최근 일정) + 하단 grid(적재 데이터 + 공지).

import { QuickStartTiles } from "./QuickStartTiles";
import { TodoWidget } from "./TodoWidget";
import { InProgressWidget } from "./InProgressWidget";
import { UpcomingEventsWidget } from "./UpcomingEventsWidget";
import { MyDatasetsWidget } from "./MyDatasetsWidget";
import { AnnouncementsWidget } from "./AnnouncementsWidget";
import {
  MOCK_DATASETS,
  MOCK_IN_PROGRESS,
  MOCK_NOTICES,
  MOCK_TODOS,
  MOCK_UPCOMING_EVENTS,
} from "./widget-mock-data";

export function HomeDashboard() {
  return (
    <div className="flex flex-col gap-5">
      <QuickStartTiles />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_240px]">
        <div className="flex flex-col gap-3">
          <TodoWidget items={MOCK_TODOS} />
          <InProgressWidget items={MOCK_IN_PROGRESS} />
        </div>
        <UpcomingEventsWidget items={MOCK_UPCOMING_EVENTS} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MyDatasetsWidget items={MOCK_DATASETS} />
        <AnnouncementsWidget items={MOCK_NOTICES} />
      </div>
    </div>
  );
}
