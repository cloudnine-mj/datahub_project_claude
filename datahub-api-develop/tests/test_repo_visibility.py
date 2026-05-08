"""Schema-level unit tests for repository visibility / public_access (governance §Formal Model).

라우터/DB 결합 테스트는 별도 통합 테스트에서 다룬다.
"""

from __future__ import annotations

import pytest

from app.schemas.repos import (
    PublicAccess,
    expand_preset,
    normalize_visibility,
    validate_dependencies,
)


class TestNormalize:
    def test_all_true_normalizes_to_public(self):
        pa = PublicAccess(
            discoverable=True,
            metadata_read=True,
            file_list=True,
            file_read=True,
            lineage_read=True,
            stats_read=True,
        )
        assert normalize_visibility(pa) == "public"

    def test_all_false_normalizes_to_private(self):
        pa = PublicAccess(
            discoverable=False,
            metadata_read=False,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
        assert normalize_visibility(pa) == "private"

    def test_mixed_normalizes_to_fine_grained(self):
        pa = PublicAccess(
            discoverable=True,
            metadata_read=True,
            file_list=False,
            file_read=False,
            lineage_read=True,
            stats_read=False,
        )
        assert normalize_visibility(pa) == "fine_grained"


class TestExpandPreset:
    def test_public_expands_all_true(self):
        pa = expand_preset("public")
        assert all(
            (pa.discoverable, pa.metadata_read, pa.file_list, pa.file_read, pa.lineage_read, pa.stats_read)
        )

    def test_private_expands_all_false(self):
        pa = expand_preset("private")
        assert not any(
            (pa.discoverable, pa.metadata_read, pa.file_list, pa.file_read, pa.lineage_read, pa.stats_read)
        )

    def test_fine_grained_requires_explicit_set(self):
        with pytest.raises(ValueError):
            expand_preset("fine_grained")


class TestDependencies:
    def test_file_read_requires_file_list(self):
        pa = PublicAccess(file_read=True, file_list=False, metadata_read=True)
        with pytest.raises(ValueError, match="file_read"):
            validate_dependencies(pa)

    def test_file_list_requires_metadata_read(self):
        pa = PublicAccess(file_list=True, metadata_read=False, file_read=False)
        with pytest.raises(ValueError, match="file_list"):
            validate_dependencies(pa)

    def test_lineage_requires_metadata_read(self):
        pa = PublicAccess(lineage_read=True, metadata_read=False, file_list=False, file_read=False)
        with pytest.raises(ValueError, match="lineage_read"):
            validate_dependencies(pa)

    def test_stats_requires_metadata_read(self):
        pa = PublicAccess(
            stats_read=True,
            metadata_read=False,
            file_list=False,
            file_read=False,
            lineage_read=False,  # 명시 — default=True 면 lineage 의존이 먼저 raise
        )
        with pytest.raises(ValueError, match="stats_read"):
            validate_dependencies(pa)

    def test_valid_chain_passes(self):
        # file_read=true 면 file_list=true & metadata_read=true 도 true 라야 valid
        pa = PublicAccess(
            discoverable=True,
            metadata_read=True,
            file_list=True,
            file_read=True,
            lineage_read=True,
            stats_read=True,
        )
        validate_dependencies(pa)  # no raise

    def test_metadata_only_passes(self):
        pa = PublicAccess(
            discoverable=True,
            metadata_read=True,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
        validate_dependencies(pa)  # no raise

    def test_all_false_passes(self):
        pa = PublicAccess(
            discoverable=False,
            metadata_read=False,
            file_list=False,
            file_read=False,
            lineage_read=False,
            stats_read=False,
        )
        validate_dependencies(pa)  # no raise — private 도 valid
