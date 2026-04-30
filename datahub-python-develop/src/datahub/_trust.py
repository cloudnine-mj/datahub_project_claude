"""OS-native TLS trust store integration.

`certifi` (Python HTTPS 클라이언트의 기본 CA 번들) 은 Mozilla 의 공인 CA 만
포함하므로, 사내망의 TLS 검사 프록시(Zscaler / Palo Alto / Bluecoat 등) 가
끼어들 때 발급되는 사설 CA 를 모릅니다. 그 결과 브라우저·curl 은 통과하지만
Python 도구만 `CERTIFICATE_VERIFY_FAILED` 로 실패하는 일이 흔합니다.

`truststore` 는 SSL 검증을 OS 네이티브 트러스트 저장소로 보내 이 문제를
해결합니다:
  - macOS  → Security framework (Keychain)
  - Windows → CryptoAPI
  - Linux  → OpenSSL 시스템 번들 (/etc/ssl/certs 등)

회사 IT 가 OS 키체인에 설치한 사설 루트 CA 가 자동으로 인식되어,
사용자가 환경변수·CA 번들 추출 같은 별도 셋업 없이 회사망에서 정상 동작.

동작 정책
---------
- Python >= 3.10 + `truststore` 설치됨 → 주입 (사용자 모르게 transparent)
- Python < 3.10 또는 `truststore` 미설치 → no-op (기존 certifi 동작 유지)
- `DATAHUB_DISABLE_TRUSTSTORE=1` 환경변수 → 명시적 opt-out
- 어떤 실패도 silently 흡수 — TLS 자체는 certifi 로 fallback
- 호출은 idempotent — 여러 번 불러도 1회만 주입

이 모듈은 `datahub` 패키지 import 시점에 자동 호출됩니다 (__init__.py).
"""

from __future__ import annotations

import os
import sys

_INJECTED = False


def apply_os_trust() -> bool:
    """OS 네이티브 트러스트 저장소를 Python SSL 스택에 주입.

    Returns:
        True  — 주입 성공 (또는 이미 주입된 상태)
        False — 미적용 (Python<3.10, truststore 없음, 명시적 opt-out, 실패 등)
    """
    global _INJECTED
    if _INJECTED:
        return True

    if os.environ.get("DATAHUB_DISABLE_TRUSTSTORE"):
        return False

    # truststore 자체가 Python >=3.10 요구. 3.9 이하면 조용히 skip.
    if sys.version_info < (3, 10):
        return False

    try:
        import truststore  # type: ignore[import-not-found]

        truststore.inject_into_ssl()
        _INJECTED = True
        return True
    except Exception:
        # 모든 예외 흡수 — TLS 검증은 certifi 로 fallback 되며 정상 동작 가능.
        # 회사망 사용자는 별도로 SSL_CERT_FILE 환경변수로 우회 가능 (README 참고).
        return False


def is_active() -> bool:
    """현재 OS 트러스트 주입이 적용되어 있는지 확인 (진단용)."""
    return _INJECTED
