// '나의 현황' 대시보드 — Governance 홈 화면.
//   빠른 시작(6 타일) + 메인 grid(나의 할일 / 진행중인 신청 좌우 배치) + 하단 grid(적재 데이터 + 공지).

import { QuickStartTiles } from "./QuickStartTiles";
import { TodoWidget } from "./TodoWidget";
import { InProgressWidget } from "./InProgressWidget";
import { MyDatasetsWidget } from "./MyDatasetsWidget";
import { AnnouncementsWidget } from "./AnnouncementsWidget";
import {
  MOCK_DATASETS,
  MOCK_IN_PROGRESS,
  MOCK_NOTICES,
  MOCK_TODOS,
} from "./widget-mock-data";

export function HomeDashboard() {
  return (
    <div className="flex flex-col gap-5">
      <QuickStartTiles />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <TodoWidget items={MOCK_TODOS} />
        <InProgressWidget items={MOCK_IN_PROGRESS} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MyDatasetsWidget items={MOCK_DATASETS} />
        <AnnouncementsWidget items={MOCK_NOTICES} />
      </div>
    </div>
  );
}
