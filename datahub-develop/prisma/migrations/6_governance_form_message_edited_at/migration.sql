-- 진행 이력 채팅 메시지의 수정 시각 컬럼.
-- 미수정이면 NULL, 수정 시 갱신. UI 가 '(수정됨)' 표시 + sort 보조.

ALTER TABLE "GovernanceFormMessage" ADD COLUMN "editedAt" TIMESTAMP(3);
