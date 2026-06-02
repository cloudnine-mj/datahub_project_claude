"""UUIDv7 helper unit tests (governance §repo-identity-spec).

Application-side UUIDv7 (PG16 환경 — native gen_random_uuid_v7 미가용).
"""

import time
import uuid

import pytest

from app.services.repo_identity import new_uuid7


def test_new_uuid7_returns_version_7_uuid():
    u = new_uuid7()
    assert isinstance(u, uuid.UUID)
    assert u.version == 7


def test_new_uuid7_variant_is_rfc4122():
    u = new_uuid7()
    # RFC 4122 variant = 10xx in the variant bits
    assert u.variant == uuid.RFC_4122


def test_new_uuid7_time_sortable():
    """UUIDv7 의 핵심 특성 — 시간 순서가 lexicographic 순서와 일치."""
    a = new_uuid7()
    time.sleep(0.005)
    b = new_uuid7()
    time.sleep(0.005)
    c = new_uuid7()
    assert str(a) < str(b) < str(c)


def test_new_uuid7_unique_within_batch():
    """같은 ms 내에서도 random 비트로 unique 보장."""
    ids = {new_uuid7() for _ in range(1000)}
    assert len(ids) == 1000


def test_new_uuid7_embeds_unix_ms():
    """첫 48bit 가 unix epoch ms 인지 — 1초 이내 차이여야 정상."""
    before_ms = int(time.time() * 1000)
    u = new_uuid7()
    after_ms = int(time.time() * 1000)

    # UUIDv7 의 첫 48bit = unix_ts_ms
    embedded_ms = u.int >> 80
    assert before_ms - 1 <= embedded_ms <= after_ms + 1
