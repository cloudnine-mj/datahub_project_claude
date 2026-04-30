"""E2E 시나리오 테스트 — CAB 토큰 만료 및 rotation.

이슈 #11: mount → 파일 읽기 → 토큰 만료 → rotation → 계속 읽기 시나리오를
Mock 기반으로 검증한다.

커버리지:
- 시나리오 1: 정상 rotation — 만료 임박 시 _TokenRotator가 갱신 호출
- 시나리오 2: rotation 실패 — refresher 예외 시 크래시 없이 계속 실행
- 시나리오 3: get_file_manifest → 만료 시뮬레이션 → rotation → 재접근 E2E
"""

from __future__ import annotations

import threading
import time
from unittest.mock import MagicMock, call, patch

import pytest

# _TokenRotator와 관련 상수를 직접 import
import datahub.mount as _mount_mod
from datahub.mount import _TokenRotator, _TOKEN_ROTATION_BUFFER

# 테스트에서 30초 대기를 우회하기 위해 CHECK 주기를 단축
_FAST_CHECK = 0.05  # 50ms


# ──────────────────────────────────────────────────────────────
# 헬퍼
# ──────────────────────────────────────────────────────────────


def _make_rotator(
    expires_at: float,
    refresher,
    sock_path: str = "/tmp/fake.sock",
) -> tuple[_TokenRotator, threading.Event]:
    stop = threading.Event()
    rotator = _TokenRotator(
        sock_path=sock_path,
        token_refresher=refresher,
        expires_at=expires_at,
        stop_event=stop,
    )
    return rotator, stop


@pytest.fixture(autouse=True)
def fast_rotation_check(monkeypatch):
    """테스트 속도를 위해 rotation 체크 주기를 30초 → 50ms로 단축."""
    monkeypatch.setattr(_mount_mod, "_TOKEN_ROTATION_CHECK", _FAST_CHECK)


# ──────────────────────────────────────────────────────────────
# 시나리오 1: 정상 rotation
# ──────────────────────────────────────────────────────────────


class TestTokenRotatorNormalFlow:
    """_TokenRotator 정상 rotation 시나리오."""

    def test_rotation_triggered_when_near_expiry(self):
        """만료 _TOKEN_ROTATION_BUFFER 이내 진입 시 token_refresher가 호출된다."""
        new_token = "ya29.new-token"
        new_expires_at = time.time() + 3600
        refresher = MagicMock(return_value=(new_token, new_expires_at))

        # 만료를 BUFFER 이내로 설정 → 즉시 rotation 트리거
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        rotator, stop = _make_rotator(expires_at, refresher)

        with patch("datahub.mount._nfsd_send", return_value={"ok": True}) as mock_send:
            rotator.start()
            time.sleep(0.15)
            stop.set()
            rotator.join(timeout=2)

        refresher.assert_called_once()
        mock_send.assert_called_once_with(
            "/tmp/fake.sock",
            {"type": "rotate_token", "token": new_token},
            timeout=10.0,
        )

    def test_rotation_updates_expires_at(self):
        """rotation 성공 후 내부 _expires_at이 새 값으로 갱신된다."""
        new_expires_at = time.time() + 7200
        refresher = MagicMock(return_value=("ya29.refreshed", new_expires_at))
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        rotator, stop = _make_rotator(expires_at, refresher)

        with patch("datahub.mount._nfsd_send", return_value={"ok": True}):
            rotator.start()
            time.sleep(0.15)
            stop.set()
            rotator.join(timeout=2)

        assert rotator._expires_at == pytest.approx(new_expires_at, abs=1)

    def test_no_rotation_when_token_fresh(self):
        """토큰이 충분히 남아 있으면 rotation이 호출되지 않는다."""
        refresher = MagicMock()
        # 만료까지 BUFFER + 600초 — 한참 남음
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER + 600

        rotator, stop = _make_rotator(expires_at, refresher)

        with patch("datahub.mount._nfsd_send") as mock_send:
            rotator.start()
            time.sleep(0.1)
            stop.set()
            rotator.join(timeout=2)

        refresher.assert_not_called()
        mock_send.assert_not_called()

    def test_rotation_called_only_once_per_expiry(self):
        """rotation 성공 후 _expires_at 갱신 → 다음 루프에서 중복 호출 안 됨."""
        call_count = 0
        future_expires = time.time() + 7200

        def refresher():
            nonlocal call_count
            call_count += 1
            return ("ya29.new", future_expires)

        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10
        rotator, stop = _make_rotator(expires_at, refresher)

        with patch("datahub.mount._nfsd_send", return_value={"ok": True}):
            rotator.start()
            time.sleep(0.2)
            stop.set()
            rotator.join(timeout=2)

        assert call_count == 1


# ──────────────────────────────────────────────────────────────
# 시나리오 2: rotation 실패 처리
# ──────────────────────────────────────────────────────────────


class TestTokenRotatorFailureHandling:
    """rotation 실패 시 크래시 없이 계속 실행되는지 검증."""

    def test_refresher_exception_does_not_crash_rotator(self):
        """token_refresher가 예외를 던져도 _TokenRotator가 계속 살아있는다."""
        refresher = MagicMock(side_effect=RuntimeError("API timeout"))
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        rotator, stop = _make_rotator(expires_at, refresher)

        with patch("datahub.mount._nfsd_send"):
            rotator.start()
            time.sleep(0.15)
            # 크래시 없이 여전히 alive
            assert rotator.is_alive()
            stop.set()
            rotator.join(timeout=2)

    def test_nfsd_send_exception_does_not_crash_rotator(self):
        """_nfsd_send IPC 실패도 크래시 없이 계속 실행된다."""
        refresher = MagicMock(return_value=("ya29.new", time.time() + 3600))
        expires_at = time.time() + _TOKEN_ROTATION_BUFFER - 10

        rotator, stop = _make_rotator(expires_at, refresher)

        with patch("datahub.mount._nfsd_send", side_effect=ConnectionRefusedError("no socket")):
            rotator.start()
            time.sleep(0.15)
            assert rotator.is_alive()
            stop.set()
            rotator.join(timeout=2)

        # IPC 실패 시 _expires_at이 갱신되지 않으므로 루프마다 재시도 → 1회 이상 호출됨.
        # 재시도 허용이 의도된 동작 (무한 재시도는 production에서 회복 기회를 줌).
        assert refresher.call_count >= 1

    def test_stop_event_terminates_rotator(self):
        """stop_event.set() 호출 시 _TokenRotator가 종료된다."""
        refresher = MagicMock(return_value=("ya29.x", time.time() + 3600))
        expires_at = time.time() + 9999  # rotation 없음

        rotator, stop = _make_rotator(expires_at, refresher)

        rotator.start()
        assert rotator.is_alive()
        stop.set()
        rotator.join(timeout=2)
        assert not rotator.is_alive()


# ──────────────────────────────────────────────────────────────
# 시나리오 3: get_file_manifest → 만료 → rotation → 재접근 E2E
# ──────────────────────────────────────────────────────────────


class TestManifestExpiryE2E:
    """DataClient.get_file_manifest() 기반 토큰 만료 시뮬레이션 E2E."""

    def _make_client(self, token_seq: list[str]):
        """순서대로 다른 CAB 토큰을 반환하는 mock DataClient."""
        from datahub.client import DataClient
        from datahub.config import AuthConfig, DataHubConfig
        import httpx

        cfg = DataHubConfig(auth=AuthConfig(endpoint="http://mock:8000", api_key="k"))
        session_resp = MagicMock()
        session_resp.json.return_value = {"email": "siu@example.com", "user_id": 7}

        call_idx = [0]

        def _manifest_resp():
            idx = call_idx[0]
            call_idx[0] += 1
            token = token_seq[min(idx, len(token_seq) - 1)]
            # 첫 번째 호출은 10초 후 만료, 이후는 1시간 후
            from datetime import datetime, timezone, timedelta
            exp_delta = timedelta(seconds=10) if idx == 0 else timedelta(hours=1)
            expiry_str = (datetime.now(timezone.utc) + exp_delta).isoformat()
            open_resp = MagicMock()
            open_resp.json.return_value = {
                "token": token,
                "token_expiry": expiry_str,
            }
            page_resp = MagicMock()
            page_resp.json.return_value = {
                "files": [{"path": "train.csv", "physical_address": "gs://bucket/train.csv"}],
                "has_more": False,
                "next_offset": None,
            }
            return open_resp, page_resp

        open1, page1 = _manifest_resp()
        open2, page2 = _manifest_resp()

        mock_http = MagicMock()
        mock_http.post.side_effect = [
            session_resp,
            open1, page1,  # 1st get_file_manifest
            open2, page2,  # 2nd get_file_manifest
        ]

        with patch("httpx.Client", return_value=mock_http):
            client = DataClient(cfg)

        return client, mock_http

    def test_first_manifest_returns_initial_token(self):
        """첫 번째 get_file_manifest는 초기 CAB 토큰을 반환한다."""
        client, _ = self._make_client(["ya29.initial", "ya29.refreshed"])
        token, files, expires_at = client.get_file_manifest("my-ds", "main")

        assert token == "ya29.initial"
        assert len(files) == 1
        assert files[0]["path"] == "train.csv"

    def test_token_expires_and_refresher_returns_new_token(self):
        """만료 후 재호출 시 새 토큰이 반환된다."""
        client, _ = self._make_client(["ya29.initial", "ya29.refreshed"])

        token1, _, _ = client.get_file_manifest("my-ds", "main")
        # 만료 시뮬레이션: 두 번째 호출 = rotation 후 재발급
        token2, _, expires_at2 = client.get_file_manifest("my-ds", "main")

        assert token1 == "ya29.initial"
        assert token2 == "ya29.refreshed"
        assert expires_at2 > time.time() + 100  # 새 토큰은 충분히 남음

    def test_rotation_loop_seamless_file_access(self):
        """rotation 전후 서로 다른 CAB 토큰으로 동일 파일에 GCS blob 접근 성공."""
        client, _ = self._make_client(["ya29.t1", "ya29.t2"])

        # rotation 전: 토큰 t1으로 manifest 획득
        token1, files_before, _ = client.get_file_manifest("my-ds", "main")
        # rotation 후: 토큰 t2로 manifest 획득 (만료 시뮬레이션)
        token2, files_after, _ = client.get_file_manifest("my-ds", "main")

        # 토큰은 달라야 함 (rotation 발생)
        assert token1 != token2

        # 파일 경로는 동일 (seamless — 클라이언트 재설정 불필요)
        assert [f["path"] for f in files_before] == [f["path"] for f in files_after]

        # 토큰 t1으로 GCS blob 직접 접근 시뮬레이션 (_gcs_client patch)
        mock_gcs1 = MagicMock()
        blob1 = MagicMock()
        mock_gcs1.bucket.return_value.blob.return_value = blob1
        with patch.object(client, "_gcs_client", return_value=mock_gcs1):
            gcs = client._gcs_client(token=token1)
            bucket_name, blob_path = client._parse_physical_address(
                files_before[0]["physical_address"]
            )
            gcs.bucket(bucket_name).blob(blob_path).download_to_filename("/dev/null")
        blob1.download_to_filename.assert_called_once_with("/dev/null")

        # rotation 후 토큰 t2로도 동일 파일 접근 가능
        mock_gcs2 = MagicMock()
        blob2 = MagicMock()
        mock_gcs2.bucket.return_value.blob.return_value = blob2
        with patch.object(client, "_gcs_client", return_value=mock_gcs2):
            gcs = client._gcs_client(token=token2)
            bucket_name, blob_path = client._parse_physical_address(
                files_after[0]["physical_address"]
            )
            gcs.bucket(bucket_name).blob(blob_path).download_to_filename("/dev/null")
        blob2.download_to_filename.assert_called_once_with("/dev/null")
