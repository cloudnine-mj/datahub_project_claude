"""Access Token 형식 — 발급 / 검증 헬퍼.

architecture/access-tokens.md §4 구현.

토큰 형식:
    <prefix><body><checksum>
    예: dh_aA8x3KpQ <43 char body> <6 char crc32 base32>

prefix:
    'dh_' (v2, 본 spec)
    'dl_' (v1 호환, 3 개월 한시)

검증 1차 게이트 — `verify_format(raw)` 가 prefix + checksum 만으로 빠르게 판단.
DB 조회 / bcrypt 검증 전에 호출하여 잘못된 토큰을 즉시 401 처리.
"""

from __future__ import annotations

import base64
import secrets
import zlib
from typing import Tuple

import bcrypt

PREFIX_V2 = "dh_"
PREFIX_V1 = "dl_"  # 3 개월 grace, cut-off 후 reject
_PREFIX_LENGTH = 11  # 'dh_' or 'dl_' + 8 char


def _crc32_checksum(body: str) -> str:
    """CRC32 of body → base32 (lowercase, no pad), 6 char.

    body 의 무결성 검증용. 키보드 입력 오타 / 복사 누락 즉시 탐지.
    암호학적 무결성 보장은 아님 (그건 bcrypt 검증의 역할).
    """
    crc = zlib.crc32(body.encode())
    encoded = base64.b32encode(crc.to_bytes(4, "big")).decode().rstrip("=").lower()
    return encoded[:6]


def generate_access_token() -> Tuple[str, str, str]:
    """신규 v2 access token 발급.

    Returns:
        (raw, prefix, hash) tuple.
          raw    : 사용자에게 1회 노출하는 문자열 (저장 금지)
          prefix : DB 조회용 11 자 ('dh_' + 8 자)
          hash   : DB 저장용 bcrypt 해시
    """
    body = secrets.token_urlsafe(32)
    checksum = _crc32_checksum(body)
    raw = f"{PREFIX_V2}{body}{checksum}"
    prefix = raw[:_PREFIX_LENGTH]
    token_hash = bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()
    return raw, prefix, token_hash


def verify_format(raw: str) -> bool:
    """1차 게이트 — prefix + checksum 만으로 형식 검증.

    True 반환 시 DB 조회 / bcrypt 검증 진행.
    False 반환 시 즉시 401 (DB 자원 절약).

    레거시 ``dl_`` 토큰은 형식 검증을 적용하지 않는다 (구 발급 키들이 checksum
    을 포함하지 않으므로). cut-off 후에는 dependencies.py 에서 reject.
    """
    if not raw:
        return False

    if raw.startswith(PREFIX_V1):
        return True  # 레거시는 형식 검증 미적용

    if not raw.startswith(PREFIX_V2):
        return False

    # 'dh_' (3) + body (>= 1) + checksum (6)
    if len(raw) <= len(PREFIX_V2) + 6:
        return False

    body = raw[len(PREFIX_V2):-6]
    expected = _crc32_checksum(body)
    return expected == raw[-6:]


def mask_token(prefix: str) -> str:
    """응답 표기용 mask. 사용자가 어떤 토큰인지 식별만 가능하도록.

    예: 'dh_aA8x3KpQ' → 'dh_…aA8x3KpQ'
    """
    return f"{prefix[:3]}…{prefix[3:]}"


def extract_prefix(raw: str) -> str:
    """raw 토큰에서 DB 조회용 prefix 만 추출 (앞 11 자)."""
    return raw[:_PREFIX_LENGTH]
