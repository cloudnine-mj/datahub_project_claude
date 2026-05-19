-- datahub-auth-redesign §16 Phase W6: NextAuth 제거 후 잔여 스키마 정리.
--
-- 변경:
--   1. Account / Session / VerificationToken 테이블 제거 (NextAuth adapter).
--   2. User.role 컬럼 제거 — role 은 datahub-api `/auth/session` 응답에서 읽는다.
--   3. UserRole enum 제거 (다른 참조 없음).
--
-- 유지:
--   - User.labId / User.techCellId — Lab/TechCell 관계는 Web 에서 소유 중.

-- ── NextAuth adapter tables ───────────────────────────────────────────────
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "VerificationToken" CASCADE;

-- ── User.role drop ────────────────────────────────────────────────────────
ALTER TABLE "User" DROP COLUMN IF EXISTS "role";

-- ── UserRole enum drop (사용처 제거 후) ───────────────────────────────────
DROP TYPE IF EXISTS "UserRole";
