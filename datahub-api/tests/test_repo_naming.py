"""GCS 버킷 명명 규칙 단위 테스트.

governance §생성 계약: 'owner와 name은 소문자 알파벳, 숫자, 하이픈을 기본 허용'.
"""

from __future__ import annotations

import pytest

from app.services.repo_naming import (
    DELIMITER,
    MAX_GCS_BUCKET_LENGTH,
    make_gcs_key,
    make_opaque_gcs_key,
    normalize_segment,
    split_gcs_key,
    validate_bucket_name,
)


class TestNormalize:
    def test_lowercase(self):
        assert normalize_segment("MyRepo") == "myrepo"

    def test_slash_to_hyphen(self):
        assert normalize_segment("a/b/c") == "a-b-c"

    def test_underscore_to_hyphen(self):
        assert normalize_segment("my_repo_name") == "my-repo-name"

    def test_other_invalid_chars(self):
        assert normalize_segment("hello world!") == "hello-world"

    def test_collapse_consecutive(self):
        assert normalize_segment("a---b") == "a-b"
        assert normalize_segment("a__b") == "a-b"

    def test_strip_edges(self):
        assert normalize_segment("-foo-") == "foo"


class TestMakeGcsKey:
    def test_with_group(self):
        assert make_gcs_key("lab-foo", "ner-models") == f"lab-foo{DELIMITER}ner-models"

    def test_without_group(self):
        assert make_gcs_key(None, "ner-models") == "ner-models"

    def test_normalizes_both(self):
        assert make_gcs_key("Lab_Foo", "My/Repo") == "lab-foo--my-repo"

    def test_underscore_in_repo(self):
        # 사용자 보고: shseo_cli_testing → shseo-cli-testing
        assert make_gcs_key(None, "shseo_cli_testing") == "shseo-cli-testing"

    def test_empty_repo_raises(self):
        with pytest.raises(ValueError, match="repo_name"):
            make_gcs_key(None, "____")  # normalize 후 empty

    def test_empty_group_raises(self):
        with pytest.raises(ValueError, match="group"):
            make_gcs_key("///", "ok")


class TestMakeOpaqueGcsKey:
    """rev.6 변경: input = repo_uuid (immutable). slug rename 시 bucket 무변."""

    REPO_UUID = "01928f7c-1234-7abc-89de-fedcba012345"

    def test_stable_opaque_key(self):
        first = make_opaque_gcs_key(self.REPO_UUID)
        second = make_opaque_gcs_key(self.REPO_UUID)
        assert first == second
        assert first.startswith("r-")
        assert len(first) == len("r-") + 24

    def test_different_uuid_changes_key(self):
        other = "01928f7c-1234-7abc-89de-fedcba999999"
        assert make_opaque_gcs_key(self.REPO_UUID) != make_opaque_gcs_key(other)

    def test_hash_version_changes_key(self):
        v1 = make_opaque_gcs_key(self.REPO_UUID, hash_version=1)
        v2 = make_opaque_gcs_key(self.REPO_UUID, hash_version=2)
        assert v1 != v2

    def test_empty_uuid_raises(self):
        import pytest
        with pytest.raises(ValueError, match="repo_uuid"):
            make_opaque_gcs_key("")

    def test_bucket_name_within_63_chars(self):
        key = make_opaque_gcs_key(self.REPO_UUID)
        # prefix lgair-dgdh-stg (14) + - + r-<24hex> (26) = 41 < 63
        full = f"lgair-dgdh-stg-{key}"
        assert len(full) <= 63


class TestSplit:
    def test_with_delimiter(self):
        assert split_gcs_key(f"lab-foo{DELIMITER}my-repo") == ("lab-foo", "my-repo")

    def test_without_delimiter(self):
        assert split_gcs_key("my-repo") == (None, "my-repo")

    def test_multiple_delimiter_keeps_first(self):
        # group 에는 '--' 가 들어가지 않는 가정. 그러나 안전하게 첫 split.
        assert split_gcs_key(f"a{DELIMITER}b{DELIMITER}c") == ("a", f"b{DELIMITER}c")

    def test_round_trip(self):
        key = make_gcs_key("lab-foo", "ner-models")
        group, repo = split_gcs_key(key)
        assert group == "lab-foo"
        assert repo == "ner-models"


class TestValidateBucketName:
    """GCS 한도 (63 chars including prefix) 가드."""

    def test_within_limit_returns_full_name(self):
        full = validate_bucket_name("datahub-dev", "lab", "ner")
        assert full == "datahub-dev-lab--ner"
        assert len(full) <= MAX_GCS_BUCKET_LENGTH

    def test_at_exact_limit_passes(self):
        # prefix + '-' + gcs_key 총 63 인 케이스. prefix=10, group+'--'+repo 가 52.
        prefix = "datahub-pr"  # 10
        group = "a" * 25
        repo = "b" * 25  # gcs_key = 25 + 2 + 25 = 52 → full = 10 + 1 + 52 = 63
        full = validate_bucket_name(prefix, group, repo)
        assert len(full) == 63

    def test_exceeding_limit_raises(self):
        prefix = "datahub-pr"
        group = "a" * 30
        repo = "b" * 30  # full 길이가 64 이상이 됨
        with pytest.raises(ValueError, match="63-character limit"):
            validate_bucket_name(prefix, group, repo)

    def test_empty_prefix_raises(self):
        with pytest.raises(ValueError, match="prefix"):
            validate_bucket_name("", "group", "repo")

    def test_google_restricted_term_raises_before_provisioning(self):
        with pytest.raises(ValueError, match="restricted term"):
            validate_bucket_name("lgair-dgdh-dev", "hf-google-research", "mbpp")

    def test_error_message_includes_segments(self):
        with pytest.raises(ValueError) as exc:
            validate_bucket_name("datahub-dev", "x" * 40, "y" * 40)
        msg = str(exc.value)
        # 사용자 디버깅에 도움이 되도록 길이/segment 정보 노출
        assert "length=" in msg
        assert "group=" in msg
        assert "repo=" in msg

    def test_no_group_uses_only_repo(self):
        full = validate_bucket_name("datahub-dev", None, "small")
        assert full == "datahub-dev-small"
