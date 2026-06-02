from __future__ import annotations

from unittest.mock import MagicMock, patch

from scripts.remove_bucket_lifecycle_rules import remove_bucket_lifecycle_rules


def test_remove_bucket_lifecycle_rules_clears_explicit_bucket_rules() -> None:
    bucket = MagicMock()
    bucket.lifecycle_rules = [{"action": {"type": "Delete"}, "condition": {"age": 90}}]
    client = MagicMock()
    client.bucket.return_value = bucket

    with patch("scripts.remove_bucket_lifecycle_rules.storage.Client", return_value=client):
        remove_bucket_lifecycle_rules(
            project="demo-project",
            buckets=["demo-bucket"],
            prefix="",
            apply_changes=True,
        )

    bucket.reload.assert_called()
    bucket.clear_lifecycle_rules.assert_called_once()
    bucket.patch.assert_called_once()


def test_remove_bucket_lifecycle_rules_lists_buckets_by_prefix_in_dry_run() -> None:
    bucket = MagicMock()
    bucket.name = "lgair-dgdh-dev-demo"
    target_bucket = MagicMock()
    target_bucket.lifecycle_rules = []
    client = MagicMock()
    client.list_buckets.return_value = [bucket]
    client.bucket.return_value = target_bucket

    with patch("scripts.remove_bucket_lifecycle_rules.storage.Client", return_value=client):
        remove_bucket_lifecycle_rules(
            project="demo-project",
            buckets=[],
            prefix="lgair-dgdh-dev",
            apply_changes=False,
        )

    client.list_buckets.assert_called_once_with(prefix="lgair-dgdh-dev")
    target_bucket.clear_lifecycle_rules.assert_not_called()
    target_bucket.patch.assert_not_called()


def test_remove_bucket_lifecycle_rules_requires_prefix_without_explicit_buckets(monkeypatch) -> None:
    client = MagicMock()
    monkeypatch.delenv("GCP_BUCKET_PREFIX", raising=False)
    monkeypatch.delenv("DATAHUB_GCP_BUCKET_PREFIX", raising=False)

    with patch("scripts.remove_bucket_lifecycle_rules.storage.Client", return_value=client):
        try:
            remove_bucket_lifecycle_rules(
                project="demo-project",
                buckets=[],
                prefix="",
                apply_changes=False,
            )
        except ValueError as exc:
            assert "bucket prefix is required" in str(exc)
        else:
            raise AssertionError("expected missing prefix to fail")

    client.list_buckets.assert_not_called()
