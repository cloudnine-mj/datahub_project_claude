"""SQLAlchemy ORM 모델.

테이블:
  - users: 사용자 (이메일 기반)
  - access_tokens: 머신 인증용 access token (구 api_keys, alembic 013 에서 rename)
  - access_token_grants: fine-grained 권한 grants (token_id × resource × action)
  - repos: 레포지토리 (owner_id = RBAC owner role 의 진실 source. group_id = 소속 그룹 namespace)
  - permissions: maintainer/contributor/guest 권한 부여 (013 에서 developer→contributor)
  - audit_logs: 모든 행위 추적
  - upload_sessions: 다중 파일 업로드 세션 관리
  - upload_session_files: 세션별 개별 파일 추적

terminology (alembic 017, governance §그룹 네임스페이스):
  - namespace 표현은 모두 `group` (구 `org`/`organization` 의 namespace 의미만 통일).
  - RBAC role `owner` (Permission.role / Repo.owner_id / Organization.owner_id) 는 보존.
  - 테이블 이름 `organizations`/`organization_memberships` 는 외부 API 호환을 위해 유지.
"""

from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship


def _new_uuid7_str() -> str:
    """ORM default — Organization/Repo 생성 시 application-side UUIDv7 자동 발급.

    governance §repo-identity-spec (UUIDv7 application-side, PG16 환경).
    repo_identity 모듈에서 helper 재export — circular import 회피.
    """
    from app.services.repo_identity import new_uuid7
    return str(new_uuid7())


class Base(DeclarativeBase):
    pass


def _jsonb_type():
    return JSONB().with_variant(JSON(), "sqlite")


# ── 기존 테이블 (token-service에서 이관) ──────────────────


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # 통합 auth 프로필 (datahub-auth-redesign §16). Web 의 Prisma User 테이블에서
    # 이관된 필드 — 실제 값은 외부(관리자 또는 동기화 작업) 에서 채운다.
    name = Column(String(255), nullable=True)  # Google display name (다음 로그인 때 lazy 채움)
    role = Column(String(16), nullable=False, server_default="USER")
    lab_id = Column(String(64), nullable=True)
    tech_cell_id = Column(String(64), nullable=True)

    # Azure AD SSO identity (governance §auth-and-api-keys §1.2). transition 동안 nullable.
    # azure_oid 는 partial unique index (alembic 025).
    azure_oid = Column(Text, nullable=True)
    azure_tid = Column(Text, nullable=True)
    linked_at = Column(DateTime(timezone=True), nullable=True)

    access_tokens = relationship("AccessToken", back_populates="user")
    owned_repos = relationship("Repo", back_populates="owner")
    permissions = relationship("Permission", back_populates="user", foreign_keys="Permission.user_id")


class AccessToken(Base):
    """v2 access token (구 api_keys 테이블, alembic 013 에서 rename).

    토큰 효력은 본 row 의 token_type + 연결된 access_token_grants 조합으로 결정.
      - read  : grants 에 (user, '*', read) 1건만 — RBAC ∩ {read}
      - write : grants 에 (user, '*', write) 1건만 — RBAC ∩ {read, write}
      - fine_grained : grants 가 명시 입력된 항목들의 합집합

    검증 흐름은 architecture/access-tokens.md §1.4 (RBAC 매트릭스) 와 §3.3 참조.
    """

    __tablename__ = "access_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # 'dh_' (v2) + 8자 또는 'dl_' (v1 한시 호환) + 8자
    token_prefix = Column(String(12), unique=True, nullable=False, index=True)
    token_hash = Column(String(256), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    last_used = Column(DateTime, nullable=True)
    name = Column(String(100), nullable=False, server_default="")
    # 'read' | 'write' | 'fine_grained' — 발급 시 결정, 변경 불가
    token_type = Column(
        String(20), nullable=False, server_default="fine_grained"
    )
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    created_ip = Column(String(45), nullable=True)

    user = relationship("User", back_populates="access_tokens")
    grants = relationship(
        "AccessTokenGrant",
        back_populates="token",
        cascade="all, delete-orphan",
    )


# ── 한시 호환 alias ────────────────────────────────────────────────────────
# 외부 코드가 아직 ApiKey 를 import 하고 있을 수 있어 alias 만 노출. 본 alias 는
# 0.13 에서 제거 예정 — 그 전까지 새 코드는 AccessToken 을 직접 사용해야 한다.
ApiKey = AccessToken


class AccessTokenGrant(Base):
    """access_tokens 의 fine-grained 권한 매핑 (architecture §3.2).

    하나의 token 은 여러 grant 를 가질 수 있고, (token_id, resource_type,
    resource_id, action) 4-tuple 이 유니크. resource_id 는 '*' (와일드카드) 또는
    구체 식별자 ('nlp-lab/ner-models' 등). NULL 도 허용.
    """

    __tablename__ = "access_token_grants"
    __table_args__ = (
        UniqueConstraint(
            "token_id",
            "resource_type",
            "resource_id",
            "action",
            name="uq_access_token_grants_quad",
        ),
    )

    # Postgres 에선 BIGSERIAL, SQLite 테스트에선 INTEGER (rowid 자동)
    id = Column(
        BigInteger().with_variant(Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    token_id = Column(
        Integer,
        ForeignKey("access_tokens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    resource_type = Column(String(30), nullable=False)
    resource_id = Column(String(200), nullable=True)
    action = Column(String(30), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    token = relationship("AccessToken", back_populates="grants")


class Organization(Base):
    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint("visibility IN ('public', 'private')", name="ck_org_visibility"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    # governance §repo-identity-spec — stable id (UUIDv7, immutable, application-side 발급)
    uuid = Column(UUID(as_uuid=False), unique=True, nullable=False, default=_new_uuid7_str)
    group_name = Column(String(255), unique=True, nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    description = Column(Text, nullable=True)
    visibility = Column(String(10), nullable=False, server_default="private")
    avatar_url = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    owner = relationship("User", foreign_keys=[owner_id])
    # legacy group_id FK 기반 (dual write — 별 사이클에서 group_uuid 로 swap)
    repos = relationship("Repo", back_populates="organization", foreign_keys="Repo.group_id")
    memberships = relationship(
        "OrganizationMembership",
        back_populates="organization",
        foreign_keys="OrganizationMembership.group_id",
    )
    teams = relationship("Team", back_populates="organization", foreign_keys="Team.group_id")


class Repo(Base):
    __tablename__ = "repos"
    __table_args__ = (
        CheckConstraint(
            "visibility IN ('public', 'private', 'fine_grained')",
            name="ck_repo_visibility",
        ),
    )

    repo_name = Column(String(128), primary_key=True)
    # governance §repo-identity-spec — stable id (UUIDv7, immutable). PK swap 은 별 사이클.
    uuid = Column(UUID(as_uuid=False), unique=True, nullable=False, default=_new_uuid7_str)
    # group_uuid: organizations.uuid FK (dual write 의 UUID 측). legacy group_id 도 유지.
    group_uuid = Column(UUID(as_uuid=False), ForeignKey("organizations.uuid", ondelete="RESTRICT"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("organizations.id"), nullable=True, index=True)
    bucket_name = Column(String(256), nullable=True)
    visibility = Column(String(16), nullable=False, server_default="public")
    description = Column(Text, nullable=True)
    repo_type = Column(String(1), nullable=True, comment="A=dataset, B=model")
    # Legacy: 014 이후로 repo_public_access_policies.file_read 로 대체.
    # 호환을 위해 컬럼은 유지하되 신규 코드는 capability 를 사용한다.
    allow_anonymous_download = Column(
        Boolean, nullable=False, server_default="false"
    )
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    owner = relationship("User", back_populates="owned_repos")
    # legacy group_id FK 기반 (dual write — 별 사이클에서 group_uuid 로 swap)
    organization = relationship("Organization", back_populates="repos", foreign_keys=[group_id])
    # legacy repo_name FK 기반 — 종속 도메인은 dual write 기간 repo_name 으로 join
    permissions = relationship(
        "Permission", back_populates="repo", foreign_keys="Permission.repo_name"
    )
    public_access_policy = relationship(
        "RepoPublicAccessPolicy",
        back_populates="repo",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="RepoPublicAccessPolicy.repo_name",
    )
    metadata_record = relationship(
        "RepoMetadata",
        back_populates="repo",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
        foreign_keys="RepoMetadata.repo_name",
    )


class RepoMetadata(Base):
    """Repository card/metadata source of truth.

    Tags are stored as part of metadata, not as a separate first-class resource.
    Search/catalog views derive their results from this row plus repo properties.
    """

    __tablename__ = "repo_metadata"

    repo_name = Column(
        String(128),
        ForeignKey("repos.repo_name", ondelete="CASCADE"),
        primary_key=True,
    )
    # dual-write UUID FK (governance §database-model-spec). PR 3+ 부터 우선 사용.
    repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="CASCADE"), nullable=True, index=True)
    summary = Column(Text, nullable=True)
    tags = Column(_jsonb_type(), nullable=False, default=list)
    properties = Column(_jsonb_type(), nullable=False, default=dict)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    repo = relationship("Repo", back_populates="metadata_record", foreign_keys=[repo_name])


class MetadataVocabulary(Base):
    """Controlled metadata vocabulary managed in the database.

    Seed rows are inserted during DB initialization/migration. Runtime admin
    APIs may add or deactivate values without requiring a code deploy.
    """

    __tablename__ = "metadata_vocabularies"

    kind = Column(String(64), primary_key=True)
    item_id = Column(String(128), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, server_default="true")
    sort_order = Column(Integer, nullable=False, server_default="0")
    created_by = Column(String(320), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class RepoPublicAccessPolicy(Base):
    """비멤버(Non-Member) 가 받을 수 있는 read-only 접근의 capability set.

    governance source-of-truth:
      docs/dev_docs/product-specs/repository-visibility-policy.md (Accepted)

    Capability 의존(백엔드 normalize 가 강제):
      - file_read   → file_list 필요
      - file_list   → metadata_read 필요
      - lineage_read → metadata_read 필요
      - stats_read  → metadata_read 필요

    Display mode (repos.visibility) 는 capability 조합에서 파생:
      모두 true → 'public', 모두 false → 'private', 그 외 → 'fine_grained'.

    `version` 은 PATCH /repos/{owner}/{repo}/visibility 의 optimistic concurrency.
    """

    __tablename__ = "repo_public_access_policies"

    repo_name = Column(
        String(128),
        ForeignKey("repos.repo_name", ondelete="CASCADE"),
        primary_key=True,
    )
    repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="CASCADE"), nullable=True, index=True)
    discoverable = Column(Boolean, nullable=False, server_default="true")
    metadata_read = Column(Boolean, nullable=False, server_default="true")
    file_list = Column(Boolean, nullable=False, server_default="true")
    file_read = Column(Boolean, nullable=False, server_default="true")
    lineage_read = Column(Boolean, nullable=False, server_default="true")
    stats_read = Column(Boolean, nullable=False, server_default="true")
    version = Column(Integer, nullable=False, server_default="1")
    updated_at = Column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    repo = relationship("Repo", back_populates="public_access_policy", foreign_keys=[repo_name])


class Permission(Base):
    """repo 단위 RBAC. owner 는 repos.owner_id (단일) 로 별도 표현 — 본 테이블엔 없음.

    role enum (alembic 013 부터): 'maintainer' | 'contributor' | 'guest'
    """

    __tablename__ = "permissions"
    __table_args__ = (
        UniqueConstraint("repo_name", "user_id", name="uq_repo_user"),
        CheckConstraint(
            "role IN ('maintainer', 'contributor', 'guest')",
            name="ck_permission_role",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_name = Column(String(128), ForeignKey("repos.repo_name"), nullable=False, index=True)
    repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(String(16), nullable=False)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    repo = relationship("Repo", back_populates="permissions", foreign_keys=[repo_name])
    user = relationship("User", back_populates="permissions", foreign_keys=[user_id])
    granter = relationship("User", foreign_keys=[granted_by])


class OrganizationMembership(Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_group_membership_user"),
        CheckConstraint(
            "role IN ('owner', 'maintainer', 'contributor', 'guest')",
            name="ck_org_membership_role",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    group_uuid = Column(UUID(as_uuid=False), ForeignKey("organizations.uuid", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(16), nullable=False)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="memberships", foreign_keys=[group_id])
    user = relationship("User", foreign_keys=[user_id])
    granter = relationship("User", foreign_keys=[granted_by])


class Team(Base):
    __tablename__ = "teams"
    __table_args__ = (
        UniqueConstraint("group_id", "name", name="uq_team_group_name"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("organizations.id"), nullable=False, index=True)
    group_uuid = Column(UUID(as_uuid=False), ForeignKey("organizations.uuid", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    organization = relationship("Organization", back_populates="teams", foreign_keys=[group_id])
    creator = relationship("User", foreign_keys=[created_by])
    memberships = relationship("TeamMembership", back_populates="team")
    repo_permissions = relationship("TeamRepoPermission", back_populates="team")


class TeamMembership(Base):
    __tablename__ = "team_memberships"
    __table_args__ = (
        UniqueConstraint("team_id", "user_id", name="uq_team_membership_user"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    team = relationship("Team", back_populates="memberships")
    user = relationship("User", foreign_keys=[user_id])
    adder = relationship("User", foreign_keys=[added_by])


class TeamRepoPermission(Base):
    __tablename__ = "team_repo_permissions"
    __table_args__ = (
        UniqueConstraint("team_id", "repo_name", name="uq_team_repo_permission"),
        CheckConstraint("role IN ('maintainer', 'contributor', 'guest')", name="ck_team_repo_permission_role"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False, index=True)
    repo_name = Column(String(128), ForeignKey("repos.repo_name"), nullable=False, index=True)
    repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="CASCADE"), nullable=True, index=True)
    role = Column(String(16), nullable=False)
    granted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    team = relationship("Team", back_populates="repo_permissions")
    repo = relationship("Repo", foreign_keys=[repo_name])
    granter = relationship("User", foreign_keys=[granted_by])


class RepoLineage(Base):
    __tablename__ = "repo_lineage"
    __table_args__ = (
        UniqueConstraint("source_repo", "derived_repo", name="uq_lineage_pair"),
        CheckConstraint(
            "relation_type IN ('derived_from', 'augmented_from', 'filtered_from', 'merged_from')",
            name="ck_lineage_relation_type",
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_repo = Column(String(128), ForeignKey("repos.repo_name", ondelete="CASCADE"), nullable=False)
    derived_repo = Column(String(128), ForeignKey("repos.repo_name", ondelete="CASCADE"), nullable=False)
    source_repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="CASCADE"), nullable=True, index=True)
    derived_repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="CASCADE"), nullable=True, index=True)
    relation_type = Column(String(32), nullable=False, server_default="derived_from")
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    source = relationship("Repo", foreign_keys=[source_repo])
    derived = relationship("Repo", foreign_keys=[derived_repo])
    creator = relationship("User", foreign_keys=[created_by])


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user_email = Column(String(320), nullable=True)
    action = Column(String(64), nullable=False, index=True)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(256), nullable=True)
    details = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)
    status = Column(String(16), nullable=False, default="success")
    error_message = Column(Text, nullable=True)


class GroupRename(Base):
    """Group slug rename audit (governance §repo-identity-spec).

    `_resolve` 301 redirect 의 source. 영구 보존.
    """

    __tablename__ = "group_renames"

    id = Column(UUID(as_uuid=False), primary_key=True)
    group_uuid = Column(UUID(as_uuid=False), ForeignKey("organizations.uuid", ondelete="CASCADE"), nullable=False)
    old_slug = Column(String(255), nullable=False, index=True)
    new_slug = Column(String(255), nullable=False)
    renamed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    renamed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reason = Column(Text, nullable=True)


class RepoRename(Base):
    """Repository slug rename audit (governance §repo-identity-spec).

    `_resolve` 301 redirect 의 source. group_uuid 는 rename 시점 snapshot.
    """

    __tablename__ = "repo_renames"

    id = Column(UUID(as_uuid=False), primary_key=True)
    repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="CASCADE"), nullable=False)
    # 개인 레포는 group 이 없으므로 nullable (alembic 023 으로 완화)
    group_uuid = Column(UUID(as_uuid=False), nullable=True)
    old_name = Column(String(128), nullable=False)
    new_name = Column(String(128), nullable=False)
    renamed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    renamed_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reason = Column(Text, nullable=True)


class LegacyBucketMigration(Base):
    """Per-repo cutover 진행 상태 (plan rev.6 §Legacy bucket cutover).

    status flow: pending → created → copied → verified → manifested → swapped → deleted.
    각 단계 idempotent — `scripts/migrate_legacy_buckets.py` 가 row 의 status 를
    보고 어디까지 처리됐는지 결정.
    """

    __tablename__ = "legacy_bucket_migrations"

    id = Column(UUID(as_uuid=False), primary_key=True)
    repo_uuid = Column(UUID(as_uuid=False), ForeignKey("repos.uuid", ondelete="RESTRICT"), nullable=False, unique=True)
    old_bucket_name = Column(String(256), nullable=False)
    new_bucket_name = Column(String(256), nullable=False)
    status = Column(String(32), nullable=False, server_default="pending")
    objects_count = Column(Integer, nullable=True)
    objects_bytes = Column(BigInteger, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    error_message = Column(Text, nullable=True)
