from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str
    role: str
    department: str | None = None


class UserPermissions(BaseModel):
    can_write_policy: bool
    can_write_process: bool


class MeResponse(BaseModel):
    user: UserOut
    permissions: UserPermissions
