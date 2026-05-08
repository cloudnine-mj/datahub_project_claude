"""테스트 환경 설정 — 모듈 임포트 전 환경변수 주입."""

import os

# 실제 DB/GCS 연결 없이 SQLite in-memory로 테스트
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

# Settings 모듈 로드 전에 필수 환경변수 설정
os.environ.setdefault("INTERNAL_SERVICE_SECRET", "test-secret-key-for-unit-tests-only-32chars")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-for-unit-tests-only-32chars")
