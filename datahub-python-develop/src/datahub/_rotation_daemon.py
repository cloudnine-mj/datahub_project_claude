"""datahub._rotation_daemon — Background CAB token rotation daemon.

background 모드(`datahub mount` 프로세스 종료 후)에서
주기적으로 CAB 토큰을 갱신하는 분리 프로세스.

Usage (internal — NfsBackend가 자동 기동):
    python -m datahub._rotation_daemon \
        --state-file /tmp/datahub-nfsd/{mp}.rotate.json \
        --pid-file   /tmp/datahub-nfsd/{mp}.rotate.pid

state JSON 구조:
    {
        "sock_path":  "/tmp/datahub-nfsd/...",
        "mountpoint": "/mnt/dataset",
        "expires_at": 1743300600.0,
        "repo":       "my-dataset",
        "branch":     "main"
    }
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [rotation-daemon] %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)


def main() -> None:
    logger.error(
        "rotation daemon: NFS/FUSE マウント는 현재 개발 중입니다 (Phase 2 예정). 실행 불가."
    )
    sys.exit(1)


if __name__ == "__main__":
    main()
