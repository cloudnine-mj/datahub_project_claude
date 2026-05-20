-- 관리자 메모 기능 제거 — GovernanceAdminMemo / GovernanceAdminMemoAudit 테이블 삭제.
-- 4_governance_admin_memo 가 이미 적용된 DB 만 영향. 아직 적용 전이라면 no-op.

DROP TABLE IF EXISTS "GovernanceAdminMemoAudit";
DROP TABLE IF EXISTS "GovernanceAdminMemo";
