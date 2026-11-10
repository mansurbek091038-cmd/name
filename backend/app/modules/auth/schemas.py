from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.utils import to_local_iso
from app.modules.auth.models import User

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
Role = Literal["manager", "admin", "super_admin"]


def _email(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip().lower()
    if not EMAIL_RE.match(v) or len(v) > 255:
        raise ValueError("Email manzili noto'g'ri")
    return v


class LoginIn(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=200)
    otp: str | None = Field(None, max_length=10)

    _e = field_validator("email")(_email)


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class OtpIn(BaseModel):
    otp: str = Field(..., min_length=6, max_length=10)


class ChangePasswordIn(BaseModel):
    current_password: str = Field(..., max_length=200)
    new_password: str = Field(..., min_length=8, max_length=200)


class UserCreate(BaseModel):
    email: str
    full_name: str = Field(..., min_length=2, max_length=150)
    password: str = Field(..., min_length=8, max_length=200)
    role: Role = "manager"
    is_active: bool = True

    _e = field_validator("email")(_email)


class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = Field(None, min_length=2, max_length=150)
    password: str | None = Field(None, min_length=8, max_length=200)
    role: Role | None = None
    is_active: bool | None = None
    two_fa_enabled: bool | None = None  # only `false` is accepted: resets a user's 2FA

    _e = field_validator("email")(_email)


def user_out(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "two_fa_enabled": u.two_fa_enabled,
        "created_at": to_local_iso(u.created_at),
        "last_login_at": to_local_iso(u.last_login_at),
    }


def user_ref(u: User | None) -> dict | None:
    return {"id": u.id, "full_name": u.full_name} if u else None
