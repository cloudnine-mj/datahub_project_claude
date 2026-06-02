"""GCS bucket identifier naming rules.

governance §생성 계약: 'owner와 name은 소문자 알파벳, 숫자, 하이픈을 기본 허용'.

본 모듈은 GCS 버킷 명에 사용할 정규화된 키를 생성/파싱한다.

명명 규칙:
  - delimiter: '--' (이중 하이픈) — namespace 와 repo_name 분리
  - normalize: 소문자, '/' 와 '_' 를 '-' 로 치환, 다른 비허용 문자는 '-' 로

예시:
  ('lab_foo', 'My/Repo')  → 'lab-foo--my-repo'
  ('karlo.lee', 'my_repo') → 'karlo-lee--my-repo'
  (None,      'my_repo')  → 'my-repo'  # legacy flat key parsing/cleanup only

split 시 첫 '--' 까지가 namespace, 나머지가 repo_name:
  'lab-foo--my-repo'   → ('lab-foo', 'my-repo')
  'lab--foo--my-repo'  → ('lab', 'foo--my-repo')   # group 에 '--' 가 들어간 케이스 회피용
  'my-repo'            → (None, 'my-repo')

> group 이름에 단일 '-' 이 들어가는 건 안전 (예: 'lab-foo'). '--' 는 사용자
> 정의로 금지된다 (governance §생성 계약 의 일반적 알파넘+하이픈 규칙).
"""

from __future__ import annotations

import hashlib
import re
from typing import Optional

DELIMITER = "--"

# 소문자 알파벳/숫자/하이픈만 허용 (governance §생성 계약).
_ALLOWED = re.compile(r"[^a-z0-9-]")

# GCS bucket 이름의 외부 제약 (Google Cloud Storage):
#   - 3–63 chars (single-segment 기준). domain-name 형식 (`.` 포함) 은 더 길지만
#     본 시스템은 hyphen 만 사용하므로 63 한도가 적용된다.
#   - 본 시스템은 prefix + `-` + group + `--` + repo 로 합성하므로 prefix 길이도
#     포함해서 63 이내여야 한다.
# 참고: https://cloud.google.com/storage/docs/buckets#naming
MAX_GCS_BUCKET_LENGTH = 63
_RESERVED_BUCKET_SUBSTRINGS = ("google",)


def normalize_segment(segment: str) -> str:
    """한 segment (group 또는 repo_name) 을 GCS-safe 형태로 정규화.

    1. lowercase
    2. '/' / '_' → '-'
    3. 그 외 비허용 문자 → '-'
    4. 연속 '-' 압축 + 양끝 '-' 제거
    """
    s = segment.lower().replace("/", "-").replace("_", "-")
    s = _ALLOWED.sub("-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def make_gcs_key(group: Optional[str], repo_name: str) -> str:
    """GCS 버킷 suffix 를 생성. settings.gcp_bucket_prefix 는 호출 측에서 prepend.

    신규 생성은 `namespace--repo_name` 형식을 사용한다. group/namespace 가 없으면
    legacy flat bucket key 로 취급해 repo_name 만 반환한다.
    """
    repo_norm = normalize_segment(repo_name)
    if not repo_norm:
        raise ValueError(f"repo_name normalizes to empty: {repo_name!r}")
    if group:
        group_norm = normalize_segment(group)
        if not group_norm:
            raise ValueError(f"group normalizes to empty: {group!r}")
        return f"{group_norm}{DELIMITER}{repo_norm}"
    return repo_norm


def make_opaque_gcs_key(repo_uuid: str, hash_version: int = 1) -> str:
    """Generate a stable, rename-invariant bucket suffix from a stable repo id.

    governance §architecture/storage-transfer ("Bucket naming"):
        bucket suffix = ``r-<sha256(v{hash_version}/{repo_uuid})[:24]>``

    User-facing group/repo slug 가 hash 에 들어가지 않으므로 slug rename 시 bucket
    명이 무변. ``hash_version`` 은 알고리즘 교체 (sha256 → blake3 등) 시 bump.
    user 입력 (group/repo 길이, 금지단어) 에 비의존 → bucket 명 GCS 규칙 항상 안전.
    """
    if not repo_uuid:
        raise ValueError("repo_uuid is required for opaque bucket key")
    logical = f"v{hash_version}/{repo_uuid}"
    digest = hashlib.sha256(logical.encode("utf-8")).hexdigest()[:24]
    return f"r-{digest}"


def split_gcs_key(gcs_key: str) -> tuple[Optional[str], str]:
    """GCS 키를 (group, repo_name) 으로 split.

    DELIMITER 가 없으면 group=None.
    DELIMITER 가 여러 번 나오면 첫 번째까지만 group.
    """
    if DELIMITER not in gcs_key:
        return None, gcs_key
    group, repo = gcs_key.split(DELIMITER, 1)
    return group, repo


def validate_bucket_name(prefix: str, group: Optional[str], repo_name: str) -> str:
    """`{prefix}-{gcs_key}` 형식의 bucket 이름이 GCS 한도 (63 chars) 이내인지 검증.

    Returns:
        검증된 full bucket name.

    Raises:
        ValueError: 합산 길이가 한도 초과거나, prefix / segment 정규화 결과가 비어 있는 경우.
        router 에서 422 로 매핑한다 (governance §생성 계약 의 "이름은 GCS 안전 범위").
    """
    if not prefix:
        raise ValueError("bucket prefix must not be empty")
    gcs_key = make_gcs_key(group, repo_name)
    full = f"{prefix}-{gcs_key}"
    lowered = full.lower()
    for reserved in _RESERVED_BUCKET_SUBSTRINGS:
        if reserved in lowered:
            raise ValueError(
                "GCS bucket name contains a restricted term: "
                f"{reserved!r} in {full!r}. "
                "Use a different group and/or repository name."
            )
    if len(full) > MAX_GCS_BUCKET_LENGTH:
        # group/repo 가 함께 길어진 경우 — 사용자에게 어느 segment 가 문제인지
        # 추론 가능하도록 길이 정보 노출. credential 류는 아니므로 안전.
        group_part = (group or "").strip()
        raise ValueError(
            "GCS bucket name exceeds the 63-character limit: "
            f"{full!r} (length={len(full)}, prefix={prefix!r}, "
            f"group={group_part!r}, repo={repo_name!r}). "
            "Shorten the group and/or repository name."
        )
    return full
