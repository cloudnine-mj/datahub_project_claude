"""버전 관리 관련 타입/유틸 유닛 테스트."""

from __future__ import annotations

from datahub.types import CommitInfo, ListResult


class TestCommitInfo:
    def test_creation(self):
        commit = CommitInfo(id="abc123", message="initial commit")
        assert commit.id == "abc123"
        assert commit.committer == ""
        assert commit.metadata is None

    def test_with_committer(self):
        commit = CommitInfo(
            id="def456",
            message="add training data",
            committer="user@example.com",
        )
        assert commit.committer == "user@example.com"


class TestListResult:
    def test_iter(self):
        result = ListResult(items=["a.csv", "b.csv"], has_more=False)
        assert list(result) == ["a.csv", "b.csv"]

    def test_len(self):
        result = ListResult(items=["x", "y", "z"])
        assert len(result) == 3

    def test_has_more_pagination(self):
        result = ListResult(items=["a.parquet"], has_more=True, next_offset="cursor-abc")
        assert result.has_more is True
        assert result.next_offset == "cursor-abc"

    def test_empty(self):
        result = ListResult()
        assert len(result) == 0
        assert not result.has_more
