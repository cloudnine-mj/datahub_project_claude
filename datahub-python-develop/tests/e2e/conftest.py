"""Shared fixtures for E2E tests against a live DataHub API server.

Prerequisites:
  - ``dh login`` completed (valid credentials in ~/.datahub/credentials.json)
  - API server reachable at DATAHUB_E2E_ENDPOINT
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from typing import Generator

import httpx
import pytest

E2E_ENDPOINT = os.environ.get("DATAHUB_E2E_ENDPOINT", "https://api.datahub.lgair-data.com")
E2E_PREFIX = f"e2e-{int(time.time())}"

# Set DATAHUB_E2E_ORG manually when the API exposes a group field.
# Until datahub-api adds RepoInfo.group, leave unset → 2-component URIs.
E2E_ORG: str = os.environ.get("DATAHUB_E2E_ORG", "")


def dh_uri(repo_name: str, path: str = "") -> str:
    """Build a dh:// URI.

    Produces ``dh://{E2E_ORG}/{repo_name}/{path}`` when *E2E_ORG* is set,
    otherwise falls back to 2-component ``dh://{repo_name}/{path}``.
    """
    base = f"dh://{E2E_ORG}/{repo_name}" if E2E_ORG else f"dh://{repo_name}"
    if path:
        return f"{base}/{path.lstrip('/')}"
    return f"{base}/"


# ---------------------------------------------------------------------------
# CLI runner helper
# ---------------------------------------------------------------------------

def run_dh(*args: str, check: bool = True, timeout: int = 120) -> tuple[int, str, str]:
    """Run a ``dh`` CLI command and return *(exit_code, stdout, stderr)*.

    Args:
        *args: Arguments passed to the ``dh`` binary.
        check: If *True* (default), fail the test when the exit code is non-zero.
        timeout: Subprocess timeout in seconds.

    Returns:
        Tuple of ``(returncode, stdout, stderr)``.
    """
    result = subprocess.run(
        ["dh", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if check and result.returncode != 0:
        pytest.fail(
            f"dh {' '.join(args)} failed (exit {result.returncode}):\n"
            f"--- stdout ---\n{result.stdout}\n"
            f"--- stderr ---\n{result.stderr}"
        )
    return result.returncode, result.stdout, result.stderr


# ---------------------------------------------------------------------------
# Direct API client (for server-side state verification)
# ---------------------------------------------------------------------------

def _build_api_client() -> httpx.Client:
    """Create an httpx client using the stored CLI credentials."""
    # Try credential store first (same as DataClient._build_auth_headers)
    creds_paths = [
        os.path.expanduser("~/.datahub/credentials.json"),
        os.path.expanduser("~/.config/datahub/credentials.json"),
    ]

    token: str | None = None
    for p in creds_paths:
        if os.path.isfile(p):
            with open(p) as f:
                data = json.load(f)
            token = data.get("token")
            if token:
                break

    if not token:
        pytest.skip("No DataHub credentials found – run 'dh login' first")

    return httpx.Client(
        base_url=E2E_ENDPOINT,
        headers={"Authorization": f"Bearer {token}"},
        timeout=30.0,
        verify=False,
    )


# ---------------------------------------------------------------------------
# Session-scoped fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def api() -> Generator[httpx.Client, None, None]:
    """Direct API client for server-side state verification."""
    client = _build_api_client()
    yield client
    client.close()


@pytest.fixture(scope="session")
def endpoint() -> str:
    """The API endpoint URL used by the E2E tests."""
    return E2E_ENDPOINT


# ---------------------------------------------------------------------------
# Per-test fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def unique_repo() -> Generator[str, None, None]:
    """Generate a unique repo name and clean up after the test.

    Yields a repo name with the ``e2e-{timestamp}-{ms}`` pattern.
    After the test completes, the repo is deleted (errors are silently ignored
    so cleanup never causes a spurious test failure).
    """
    name = f"{E2E_PREFIX}-{int(time.time() * 1000) % 100000}"
    yield name
    # Cleanup — ignore errors
    run_dh("repo", "delete", name, "-y", check=False)


@pytest.fixture()
def created_repo(unique_repo: str) -> Generator[str, None, None]:
    """Create a unique repo *before* the test and clean up afterwards.

    Useful when the test needs a pre-existing repo (e.g. data operations).
    """
    run_dh("repo", "create", unique_repo)
    yield unique_repo
    # unique_repo fixture already handles cleanup
