"""User model.

권한 모델은 단순화: role 만 가짐. 향후 board 별 ACL 이 필요하면 별도 join 테이블로 확장.
  - admin: 모든 게시판에 글 작성 가능
  - editor: 모든 게시판에 글 작성 가능
  - viewer: 글 작성 불가 (read-only)
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="viewer")
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def can_write_board(self, board_type: str) -> bool:
        """게시판별 글쓰기 권한.

        정책 게시판은 admin 전용. 통합된 프로세스 게시판은 admin·editor 둘 다 가능.
        """
        if self.role == "admin":
            return True
        if self.role == "editor":
            return board_type == "process"
        return False  # viewer
