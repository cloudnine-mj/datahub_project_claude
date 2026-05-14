// '나의 현황' 대시보드 — Governance 홈 화면.
//   빠른 시작 타일 + 4개 위젯 (2x2 grid). 위젯 데이터는 mock, 추후 API 연동.

import { QuickStartTiles } from "./QuickStartTiles";
import { TodoWidget } from "./TodoWidget";
import { InProgressWidget } from "./InProgressWidget";
import { MyDatasetsWidget } from "./MyDatasetsWidget";
import { AnnouncementsWidget } from "./AnnouncementsWidget";
import {
  MOCK_ANNOUNCEMENTS,
  MOCK_DATASETS,
  MOCK_IN_PROGRESS,
  MOCK_TODOS,
} from "./widget-mock-data";

export function HomeDashboard() {
  return (
    <div className="flex flex-col gap-3">
      <QuickStartTiles />
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        <TodoWidget items={MOCK_TODOS} />
        <InProgressWidget items={MOCK_IN_PROGRESS} />
        <MyDatasetsWidget items={MOCK_DATASETS} />
        <AnnouncementsWidget items={MOCK_ANNOUNCEMENTS} />
      </div>
    </div>
  );
}
