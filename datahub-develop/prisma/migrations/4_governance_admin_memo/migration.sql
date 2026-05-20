-- 관리자 전용 메모 — 거버넌스 요청 관리(관리자 상세) 화면 우측 카드용.
-- 신청자에게 절대 노출되지 않음. 모든 변경은 GovernanceAdminMemoAudit 에 기록.

CREATE TABLE "GovernanceAdminMemo" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedById" TEXT NOT NULL,
    "lastUpdatedByName" TEXT NOT NULL,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "revisionCount" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "GovernanceAdminMemo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernanceAdminMemo_formId_date_key" ON "GovernanceAdminMemo"("formId", "date");
CREATE INDEX "GovernanceAdminMemo_formId_idx" ON "GovernanceAdminMemo"("formId");
ALTER TABLE "GovernanceAdminMemo"
    ADD CONSTRAINT "GovernanceAdminMemo_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "GovernanceForm"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 관리자 메모 변경 이력 — UI 노출 X, 감사 추적용.
CREATE TABLE "GovernanceAdminMemoAudit" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentBefore" TEXT,
    "contentAfter" TEXT,

    CONSTRAINT "GovernanceAdminMemoAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceAdminMemoAudit_formId_date_idx" ON "GovernanceAdminMemoAudit"("formId", "date");
CREATE INDEX "GovernanceAdminMemoAudit_timestamp_idx" ON "GovernanceAdminMemoAudit"("timestamp");
