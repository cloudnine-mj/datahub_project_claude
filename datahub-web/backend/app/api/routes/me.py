"""GET /me — 현재 사용자 + 권한 비트맵.

프론트 사이드바/탑바, 글쓰기 버튼 노출 분기에 사용.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models import User
from app.models.post import BOARD_TYPES
from app.schemas.user import MeResponse, UserOut, UserPermissions

router = APIRouter(tags=["me"])


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user)) -> MeResponse:
    perms = {f"can_write_{b}": user.can_write_board(b) for b in BOARD_TYPES}
    return MeResponse(user=UserOut.model_validate(user), permissions=UserPermissions(**perms))
