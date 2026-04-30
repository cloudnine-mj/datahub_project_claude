"""Tests for datahub._defaults (branch-aware DEFAULT_ENDPOINT)."""

from __future__ import annotations

import importlib
from pathlib import Path
from unittest.mock import patch

import pytest

import datahub._defaults as defaults


class TestResolveDefaultEndpoint:
    """_resolve_default_endpoint() maps current git branch to env endpoint."""

    @pytest.mark.parametrize(
        "branch, expected",
        [
            ("develop", "https://api-dev.datahub.lgair-data.com"),
            ("staging", "https://api-stg.datahub.lgair-data.com"),
            ("main",    "https://api.datahub.lgair-data.com"),
        ],
    )
    def test_known_branch(self, branch, expected):
        with patch("datahub._defaults._current_git_branch", return_value=branch):
            assert defaults._resolve_default_endpoint() == expected

    @pytest.mark.parametrize(
        "branch",
        ["feat/foo", "hotfix/bar", "release/1.2", "", "DEVELOP"],  # 대소문자 엄격
    )
    def test_unknown_branch_falls_to_prd(self, branch):
        with patch("datahub._defaults._current_git_branch", return_value=branch):
            assert defaults._resolve_default_endpoint() == defaults._PRD_FALLBACK

    def test_no_git_falls_to_prd(self):
        with patch("datahub._defaults._current_git_branch", return_value=None):
            assert defaults._resolve_default_endpoint() == defaults._PRD_FALLBACK

    def test_prd_fallback_is_prd(self):
        assert defaults._PRD_FALLBACK == "https://api.datahub.lgair-data.com"


class TestCurrentGitBranch:
    """_current_git_branch() reads .git/HEAD without spawning subprocess."""

    def test_branch_ref(self, tmp_path, monkeypatch):
        # 가짜 레포 생성: src/datahub/_defaults.py 구조 흉내
        repo = tmp_path / "repo"
        (repo / "src" / "datahub").mkdir(parents=True)
        (repo / ".git").mkdir()
        (repo / ".git" / "HEAD").write_text("ref: refs/heads/develop\n")
        fake_module_path = repo / "src" / "datahub" / "_defaults.py"
        fake_module_path.write_text("")  # 실체만 있으면 됨

        # Path(__file__) 이 fake_module_path 를 가리키게 만들기
        monkeypatch.setattr(defaults, "__file__", str(fake_module_path))
        assert defaults._current_git_branch() == "develop"

    def test_detached_head_returns_none(self, tmp_path, monkeypatch):
        repo = tmp_path / "repo"
        (repo / "src" / "datahub").mkdir(parents=True)
        (repo / ".git").mkdir()
        (repo / ".git" / "HEAD").write_text(
            "abc123def456abc123def456abc123def456abcd\n"  # SHA 직접 (detached)
        )
        fake = repo / "src" / "datahub" / "_defaults.py"
        fake.write_text("")
        monkeypatch.setattr(defaults, "__file__", str(fake))
        assert defaults._current_git_branch() is None

    def test_no_git_dir_returns_none(self, tmp_path, monkeypatch):
        repo = tmp_path / "repo"
        (repo / "src" / "datahub").mkdir(parents=True)
        # .git 없음
        fake = repo / "src" / "datahub" / "_defaults.py"
        fake.write_text("")
        monkeypatch.setattr(defaults, "__file__", str(fake))
        assert defaults._current_git_branch() is None

    def test_nested_branch_name(self, tmp_path, monkeypatch):
        """feat/sub-feature 처럼 슬래시 포함 브랜치도 보존."""
        repo = tmp_path / "repo"
        (repo / "src" / "datahub").mkdir(parents=True)
        (repo / ".git").mkdir()
        (repo / ".git" / "HEAD").write_text("ref: refs/heads/feat/sub-feature\n")
        fake = repo / "src" / "datahub" / "_defaults.py"
        fake.write_text("")
        monkeypatch.setattr(defaults, "__file__", str(fake))
        assert defaults._current_git_branch() == "feat/sub-feature"


def test_module_import_yields_string():
    """모듈 로드 시 DEFAULT_ENDPOINT 는 항상 https URL 문자열."""
    # reload 해서 실제 evaluation 검증
    importlib.reload(defaults)
    assert isinstance(defaults.DEFAULT_ENDPOINT, str)
    assert defaults.DEFAULT_ENDPOINT.startswith("https://")
