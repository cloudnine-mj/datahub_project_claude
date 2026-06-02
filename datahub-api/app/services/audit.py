"""감사 로그 기록.

모든 변경 작업 + 데이터 접근을 기록합니다.
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.models import AuditLog

logger = logging.getLogger(__name__)


class AuditService:
    """감사 로그 서비스."""

    @staticmethod
    def log(
        db: Session,
        *,
        user_id: Optional[int] = None,
        user_email: Optional[str] = None,
        action: str,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        ip_address: Optional[str] = None,
        status: str = "success",
        error_message: Optional[str] = None,
    ) -> None:
        """감사 로그 한 건 기록.

        Args:
            db: DB 세션
            user_id: 사용자 ID
            user_email: 사용자 이메일
            action: 수행된 액션 (예: upload_init, download, repo_create)
            resource_type: 리소스 타입 (예: repo, file)
            resource_id: 리소스 식별자
            details: 상세 정보 (JSONB)
            ip_address: 클라이언트 IP
            status: success 또는 failure
            error_message: 실패 시 에러 메시지
        """
        entry = AuditLog(
            user_id=user_id,
            user_email=user_email,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            ip_address=ip_address,
            status=status,
            error_message=error_message,
        )
        db.add(entry)
        db.commit()

    @staticmethod
    def query(
        db: Session,
        *,
        user_email: Optional[str] = None,
        action: Optional[str] = None,
        resource_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditLog]:
        """감사 로그 조회.

        Args:
            db: DB 세션
            user_email: 필터 - 사용자 이메일
            action: 필터 - 액션
            resource_type: 필터 - 리소스 타입
            limit: 최대 반환 수
            offset: 오프셋

        Returns:
            AuditLog 목록
        """
        q = db.query(AuditLog).order_by(AuditLog.timestamp.desc())

        if user_email:
            q = q.filter(AuditLog.user_email == user_email)
        if action:
            q = q.filter(AuditLog.action == action)
        if resource_type:
            q = q.filter(AuditLog.resource_type == resource_type)

        return q.offset(offset).limit(limit).all()


# 모듈 레벨 singleton — `from app.services.audit import audit` 로 바로 사용 가능.
audit = AuditService()
