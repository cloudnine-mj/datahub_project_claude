-- datahub-web 의 게시판(Post) + 신청서(Form) + 진행이력 채팅(FormMessage) 모델을
-- datahub-develop 로 포팅. 모든 테이블에 'Governance' prefix — 기존 Plan/Approval*
-- 과 도메인이 다르므로 네이밍 분리.
--
-- 권한 / 인증은 datahub-api 단일 소스를 따르므로 별도 role 컬럼은 두지 않는다
-- (스냅샷 용도의 authorRole / senderRole 만 보관).

-- ─── Governance Board (Posts) ──────────────────────────────────

CREATE TABLE "GovernancePost" (
    "id" TEXT NOT NULL,
    "boardType" TEXT NOT NULL,
    "docNo" TEXT,
    "docType" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "content" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "tags" JSONB,
    "severity" TEXT,
    "appliesTo" TEXT,
    "tldr" TEXT,
    "actionItems" JSONB,
    "examples" TEXT,

    CONSTRAINT "GovernancePost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernancePost_boardType_idx" ON "GovernancePost"("boardType");
CREATE INDEX "GovernancePost_docNo_idx" ON "GovernancePost"("docNo");
CREATE INDEX "GovernancePost_docType_idx" ON "GovernancePost"("docType");
CREATE INDEX "GovernancePost_isDraft_idx" ON "GovernancePost"("isDraft");
CREATE INDEX "GovernancePost_pinned_idx" ON "GovernancePost"("pinned");
CREATE INDEX "GovernancePost_visibility_idx" ON "GovernancePost"("visibility");
CREATE INDEX "GovernancePost_createdAt_idx" ON "GovernancePost"("createdAt");

CREATE TABLE "GovernancePostAttachment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GovernancePostAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernancePostAttachment_postId_idx" ON "GovernancePostAttachment"("postId");
ALTER TABLE "GovernancePostAttachment"
    ADD CONSTRAINT "GovernancePostAttachment_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "GovernancePost"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Governance Forms (신청서) ─────────────────────────────────

CREATE TABLE "GovernanceForm" (
    "id" TEXT NOT NULL,
    "requestNo" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "submitterId" TEXT NOT NULL,
    "submitterName" TEXT NOT NULL,
    "submitterEmail" TEXT NOT NULL,
    "submitterDepartment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentFormId" TEXT,
    "approvalHistory" JSONB,
    "editHistory" JSONB,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GovernanceForm_requestNo_key" ON "GovernanceForm"("requestNo");
CREATE INDEX "GovernanceForm_requestNo_idx" ON "GovernanceForm"("requestNo");
CREATE INDEX "GovernanceForm_formType_idx" ON "GovernanceForm"("formType");
CREATE INDEX "GovernanceForm_submitterId_idx" ON "GovernanceForm"("submitterId");
CREATE INDEX "GovernanceForm_status_idx" ON "GovernanceForm"("status");
CREATE INDEX "GovernanceForm_parentFormId_idx" ON "GovernanceForm"("parentFormId");
CREATE INDEX "GovernanceForm_submittedAt_idx" ON "GovernanceForm"("submittedAt");

CREATE TABLE "GovernanceFormAttachment" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GovernanceFormAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceFormAttachment_formId_idx" ON "GovernanceFormAttachment"("formId");
ALTER TABLE "GovernanceFormAttachment"
    ADD CONSTRAINT "GovernanceFormAttachment_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "GovernanceForm"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GovernanceFormComment" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceFormComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceFormComment_formId_idx" ON "GovernanceFormComment"("formId");
CREATE INDEX "GovernanceFormComment_createdAt_idx" ON "GovernanceFormComment"("createdAt");
ALTER TABLE "GovernanceFormComment"
    ADD CONSTRAINT "GovernanceFormComment_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "GovernanceForm"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 진행 이력 타임라인 메시지 — 신청자 ↔ 담당자 양방향 채팅.
-- 회신 대상(recipient)은 발신 시점에 결정되어 스냅샷 저장.

CREATE TABLE "GovernanceFormMessage" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceFormMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceFormMessage_formId_idx" ON "GovernanceFormMessage"("formId");
CREATE INDEX "GovernanceFormMessage_createdAt_idx" ON "GovernanceFormMessage"("createdAt");
ALTER TABLE "GovernanceFormMessage"
    ADD CONSTRAINT "GovernanceFormMessage_formId_fkey"
    FOREIGN KEY ("formId") REFERENCES "GovernanceForm"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GovernanceFormMessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GovernanceFormMessageAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GovernanceFormMessageAttachment_messageId_idx" ON "GovernanceFormMessageAttachment"("messageId");
ALTER TABLE "GovernanceFormMessageAttachment"
    ADD CONSTRAINT "GovernanceFormMessageAttachment_messageId_fkey"
    FOREIGN KEY ("messageId") REFERENCES "GovernanceFormMessage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
