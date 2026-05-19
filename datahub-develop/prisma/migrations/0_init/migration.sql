-- Enums
DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'USER');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PurposeType" AS ENUM ('DATA_CONSTRUCTION', 'OTHER');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UsageScope" AS ENUM ('CONFIDENTIAL', 'INTERNAL', 'MODEL_SERVICE');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalType" AS ENUM ('PROJECT', 'LAB', 'TECH_CELL', 'PROJECT_TECH_CELL');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BudgetTargetType" AS ENUM ('PROJECT', 'LAB', 'TECH_CELL');
  EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Lab (no deps except User for leader — create before User for FK)
CREATE TABLE IF NOT EXISTS "Lab" (
  "id"        TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "leaderId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Lab_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Lab_name_key" ON "Lab"("name");

-- TechCell
CREATE TABLE IF NOT EXISTS "TechCell" (
  "id"        TEXT        NOT NULL,
  "name"      TEXT        NOT NULL,
  "labId"     TEXT        NOT NULL,
  "leaderId"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechCell_pkey" PRIMARY KEY ("id")
);

-- User
CREATE TABLE IF NOT EXISTS "User" (
  "id"          TEXT        NOT NULL,
  "email"       TEXT        NOT NULL,
  "name"        TEXT,
  "image"       TEXT,
  "role"        "UserRole"  NOT NULL DEFAULT 'USER',
  "labId"       TEXT,
  "techCellId"  TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- Account (NextAuth)
CREATE TABLE IF NOT EXISTS "Account" (
  "id"                TEXT    NOT NULL,
  "userId"            TEXT    NOT NULL,
  "type"              TEXT    NOT NULL,
  "provider"          TEXT    NOT NULL,
  "providerAccountId" TEXT    NOT NULL,
  "refresh_token"     TEXT,
  "access_token"      TEXT,
  "expires_at"        INTEGER,
  "token_type"        TEXT,
  "scope"             TEXT,
  "id_token"          TEXT,
  "session_state"     TEXT,
  CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider","providerAccountId");

-- Session (NextAuth)
CREATE TABLE IF NOT EXISTS "Session" (
  "id"           TEXT        NOT NULL,
  "sessionToken" TEXT        NOT NULL,
  "userId"       TEXT        NOT NULL,
  "expires"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

-- VerificationToken (NextAuth)
CREATE TABLE IF NOT EXISTS "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "expires"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier","token");

-- Project
CREATE TABLE IF NOT EXISTS "Project" (
  "id"          TEXT            NOT NULL,
  "name"        TEXT            NOT NULL,
  "pmsCode"     TEXT,
  "pmLeaderId"  TEXT,
  "tmLeaderId"  TEXT,
  "labId"       TEXT,
  "budget"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "quarter"     TEXT,
  "year"        INTEGER,
  "startDate"   TIMESTAMP(3),
  "endDate"     TIMESTAMP(3),
  "status"      "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"   TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Project_pmsCode_key" ON "Project"("pmsCode");

-- ApprovalConfig
CREATE TABLE IF NOT EXISTS "ApprovalConfig" (
  "id"       TEXT          NOT NULL,
  "type"     "ApprovalType" NOT NULL,
  "steps"    JSONB         NOT NULL,
  "isActive" BOOLEAN       NOT NULL DEFAULT true,
  CONSTRAINT "ApprovalConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalConfig_type_key" ON "ApprovalConfig"("type");

-- Plan
CREATE TABLE IF NOT EXISTS "Plan" (
  "id"                 TEXT            NOT NULL,
  "projectId"          TEXT            NOT NULL,
  "authorId"           TEXT            NOT NULL,
  "quarter"            TEXT,
  "period"             TEXT,
  "dataManagerId"      TEXT,
  "estimatedCost"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "purposeType"        "PurposeType"   NOT NULL DEFAULT 'DATA_CONSTRUCTION',
  "purpose"            TEXT,
  "complianceChecked"  BOOLEAN         NOT NULL DEFAULT false,
  "dataName"           TEXT            NOT NULL,
  "modality"           TEXT            NOT NULL DEFAULT 'Text',
  "dataDescription"    TEXT,
  "estimatedDataCount" TEXT,
  "license"            TEXT,
  "qualityManagerId"   TEXT,
  "usageScope"         "UsageScope"    NOT NULL DEFAULT 'INTERNAL',
  "completionDate"     TIMESTAMP(3),
  "reportDueDate"      TIMESTAMP(3),
  "status"             "PlanStatus"    NOT NULL DEFAULT 'DRAFT',
  "techCellId"         TEXT,
  "labId"              TEXT,
  "createdAt"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- ApprovalRequest
CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
  "id"          TEXT                    NOT NULL,
  "planId"      TEXT,
  "reportId"    TEXT,
  "configId"    TEXT                    NOT NULL,
  "status"      "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "currentStep" INTEGER                 NOT NULL DEFAULT 1,
  "createdAt"   TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)           NOT NULL,
  CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- ApprovalStep
CREATE TABLE IF NOT EXISTS "ApprovalStep" (
  "id"         TEXT                  NOT NULL,
  "requestId"  TEXT                  NOT NULL,
  "stepOrder"  INTEGER               NOT NULL,
  "approverId" TEXT                  NOT NULL,
  "status"     "ApprovalStepStatus"  NOT NULL DEFAULT 'PENDING',
  "comment"    TEXT,
  "decidedAt"  TIMESTAMP(3),
  CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalStep_requestId_stepOrder_key" ON "ApprovalStep"("requestId","stepOrder");

-- ConstructionReport
CREATE TABLE IF NOT EXISTS "ConstructionReport" (
  "id"                  TEXT           NOT NULL,
  "planId"              TEXT           NOT NULL,
  "projectId"           TEXT           NOT NULL,
  "authorId"            TEXT           NOT NULL,
  "actualPeriodStart"   TIMESTAMP(3),
  "actualPeriodEnd"     TIMESTAMP(3),
  "dataManagerId"       TEXT,
  "actualCost"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dataDescription"     TEXT,
  "dataName"            TEXT           NOT NULL,
  "dataSize"            TEXT,
  "dataQuantity"        INTEGER,
  "qualityManagerId"    TEXT,
  "usageScope"          "UsageScope"   NOT NULL DEFAULT 'INTERNAL',
  "storageLocation"     TEXT,
  "utilizationStatus"   TEXT,
  "utilizationDate"     TEXT,
  "needsMoreData"       BOOLEAN        NOT NULL DEFAULT false,
  "followUpPlan"        TEXT,
  "status"              "ReportStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt"           TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "ConstructionReport_pkey" PRIMARY KEY ("id")
);

-- DataCard
CREATE TABLE IF NOT EXISTS "DataCard" (
  "id"              TEXT         NOT NULL,
  "reportId"        TEXT,
  "planId"          TEXT,
  "dataName"        TEXT         NOT NULL,
  "description"     TEXT,
  "dataType"        TEXT         NOT NULL DEFAULT 'Text',
  "size"            TEXT,
  "quantity"        INTEGER,
  "format"          TEXT,
  "storageLocation" TEXT,
  "accessScope"     "UsageScope" NOT NULL DEFAULT 'INTERNAL',
  "tags"            TEXT[]       NOT NULL,
  "createdById"     TEXT         NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataCard_pkey" PRIMARY KEY ("id")
);

-- Budget
CREATE TABLE IF NOT EXISTS "Budget" (
  "id"          TEXT               NOT NULL,
  "targetType"  "BudgetTargetType" NOT NULL,
  "targetId"    TEXT               NOT NULL,
  "quarter"     TEXT               NOT NULL,
  "year"        INTEGER            NOT NULL,
  "totalAmount" DOUBLE PRECISION   NOT NULL DEFAULT 0,
  "usedAmount"  DOUBLE PRECISION   NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3)      NOT NULL,
  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Budget_targetType_targetId_quarter_year_key" ON "Budget"("targetType","targetId","quarter","year");

-- CostRecord
CREATE TABLE IF NOT EXISTS "CostRecord" (
  "id"            TEXT             NOT NULL,
  "budgetId"      TEXT             NOT NULL,
  "planId"        TEXT,
  "amount"        DOUBLE PRECISION NOT NULL,
  "description"   TEXT,
  "cardUsageDate" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostRecord_pkey" PRIMARY KEY ("id")
);

-- Foreign Keys
ALTER TABLE "Lab" ADD CONSTRAINT "Lab_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "TechCell" ADD CONSTRAINT "TechCell_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TechCell" ADD CONSTRAINT "TechCell_leaderId_fkey" FOREIGN KEY ("leaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_techCellId_fkey" FOREIGN KEY ("techCellId") REFERENCES "TechCell"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_pmLeaderId_fkey" FOREIGN KEY ("pmLeaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_tmLeaderId_fkey" FOREIGN KEY ("tmLeaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_dataManagerId_fkey" FOREIGN KEY ("dataManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_qualityManagerId_fkey" FOREIGN KEY ("qualityManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_techCellId_fkey" FOREIGN KEY ("techCellId") REFERENCES "TechCell"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ConstructionReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ApprovalConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstructionReport" ADD CONSTRAINT "ConstructionReport_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstructionReport" ADD CONSTRAINT "ConstructionReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstructionReport" ADD CONSTRAINT "ConstructionReport_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstructionReport" ADD CONSTRAINT "ConstructionReport_dataManagerId_fkey" FOREIGN KEY ("dataManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructionReport" ADD CONSTRAINT "ConstructionReport_qualityManagerId_fkey" FOREIGN KEY ("qualityManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataCard" ADD CONSTRAINT "DataCard_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ConstructionReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataCard" ADD CONSTRAINT "DataCard_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataCard" ADD CONSTRAINT "DataCard_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_project_fkey" FOREIGN KEY ("targetId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_lab_fkey" FOREIGN KEY ("targetId") REFERENCES "Lab"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_techCell_fkey" FOREIGN KEY ("targetId") REFERENCES "TechCell"("id") ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "CostRecord" ADD CONSTRAINT "CostRecord_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CostRecord" ADD CONSTRAINT "CostRecord_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
