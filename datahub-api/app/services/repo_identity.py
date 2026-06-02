"""Repository identity validation helpers."""

from __future__ import annotations


VALID_REPO_CHARS = set("abcdefghijklmnopqrstuvwxyz0123456789-")
RESERVED_REPO_NAMES = frozenset(
    {
        # Governance canonical: docs/dev_docs/governance/repo-identity-spec.md
        "admin",
        "api",
        "health",
        "metrics",
        "static",
        "docs",
        "www",
        "auth",
        "login",
        "logout",
        "whoami",
        "create",
        "list",
        "delete",
        "members",
        "metadata",
        "lineage",
        "search",
        "stats",
        "token",
    }
)
SEGMENT_LIMITS = {
    "owner": (2, 63),
    "group": (2, 63),  # namespace segment — alembic 017 namespace 통일과 일치
    "repo": (2, 100),
}


def validate_repo_segment(segment: str, label: str) -> str:
    if label not in SEGMENT_LIMITS:
        raise ValueError(f"Unknown repository segment: {label}")
    min_len, max_len = SEGMENT_LIMITS[label]
    if not segment:
        raise ValueError(f"{label} is required")
    if len(segment) < min_len or len(segment) > max_len:
        raise ValueError(f"{label} length must be {min_len}-{max_len} characters")
    if segment.startswith("-") or segment.endswith("-"):
        raise ValueError(f"{label} cannot start or end with '-'")
    if segment in RESERVED_REPO_NAMES:
        raise ValueError(f"{label} reserved name is not allowed: {segment!r}")
    bad = [c for c in segment if c not in VALID_REPO_CHARS]
    if bad:
        raise ValueError(f"{label} contains invalid characters: {''.join(sorted(set(bad)))!r}")
    return segment


def parse_repo_id(repo_id: str) -> tuple[str, str]:
    if repo_id.count("/") != 1:
        raise ValueError(f"Repository id must be owner/repo: {repo_id!r}")
    owner, repo = repo_id.split("/", 1)
    return validate_repo_segment(owner, "owner"), validate_repo_segment(repo, "repo")


def personal_owner_from_email(email: str) -> str:
    local = email.split("@", 1)[0].lower()
    normalized = "".join(c if c in VALID_REPO_CHARS else "-" for c in local.replace(".", "-").replace("_", "-"))
    normalized = "-".join(part for part in normalized.split("-") if part)
    return normalized or "user"


def new_uuid7():
    """UUIDv7 발급 — 시간정렬 가능한 random UUID.

    Python stdlib `uuid.uuid7` 는 3.13+ 부터. 본 프로젝트 (3.12) + Postgres 16
    환경에서는 application-side 발급 (governance §database-model-spec, §repo-identity-spec).

    형식 (draft-ietf-uuidrev-rfc4122bis §5.7):
        | 48 bit unix_ts_ms | 4 bit version=7 | 12 bit rand_a | 2 bit variant=10 | 62 bit rand_b |
    """
    import os
    import time
    import uuid

    unix_ms = int(time.time() * 1000) & ((1 << 48) - 1)
    rand_a = int.from_bytes(os.urandom(2), "big") & 0x0FFF
    rand_b = int.from_bytes(os.urandom(8), "big") & ((1 << 62) - 1)
    value = (unix_ms << 80) | (0x7 << 76) | (rand_a << 64) | (0b10 << 62) | rand_b
    return uuid.UUID(int=value)
