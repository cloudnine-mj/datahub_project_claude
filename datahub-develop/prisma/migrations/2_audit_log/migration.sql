-- BFF / Web 자체 audit 로그 테이블.
-- 이전 마이그레이션 (`1_drop_nextauth_and_user_role`) 이후 추가.
--
-- datahub-api 의 audit_logs 와는 별개 — BFF route 가 datahub-api 호출 전후
-- + 입력 검증 실패 + 네트워크 에러까지 모두 기록한다.

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "route" TEXT,
    "status" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'success',
    "detail" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- 조회 hot path:
--   timestamp 정렬 / action 별 필터 / 사용자별 시계열 / 실패만
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_userEmail_timestamp_idx" ON "AuditLog"("userEmail", "timestamp");
CREATE INDEX "AuditLog_outcome_timestamp_idx" ON "AuditLog"("outcome", "timestamp");
