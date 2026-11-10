"""Password hashing, JWT tokens, current-user dependency and role checks (RBAC)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import bcrypt
import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.modules.auth.models import ROLE_RANK, User

ACCESS_COOKIE = "ss_access"
REFRESH_COOKIE = "ss_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"
ALGO = "HS256"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


# ---------------- passwords ----------------
def hash_password(password: str) -> str:
    # bcrypt only uses the first 72 bytes
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode())
    except (ValueError, TypeError):
        return False


_DUMMY_HASH = bcrypt.hashpw(b"timing-safety", bcrypt.gensalt(rounds=12)).decode()


def dummy_verify() -> None:
    """Spend the same time as a real check so unknown emails can't be detected by timing."""
    verify_password("x", _DUMMY_HASH)


def validate_password_strength(pw: str) -> None:
    if len(pw) < 8:
        raise AppError(422, "WEAK_PASSWORD", "Parol kamida 8 belgidan iborat bo'lishi kerak")
    if pw.isdigit() or pw.isalpha():
        raise AppError(422, "WEAK_PASSWORD", "Parolda harf va raqam bo'lishi kerak")


# ---------------- tokens ----------------
def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user: User) -> tuple[str, int]:
    s = get_settings()
    ttl = s.access_token_minutes * 60
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "ver": user.token_version,
        "type": "access",
        "iat": int(_now().timestamp()),
        "exp": int((_now() + timedelta(seconds=ttl)).timestamp()),
    }
    return jwt.encode(payload, s.secret_key, algorithm=ALGO), ttl


def create_refresh_token(user: User) -> tuple[str, str, datetime]:
    s = get_settings()
    jti = secrets.token_hex(16)
    exp = _now() + timedelta(days=s.refresh_token_days)
    payload = {
        "sub": str(user.id),
        "ver": user.token_version,
        "type": "refresh",
        "jti": jti,
        "iat": int(_now().timestamp()),
        "exp": int(exp.timestamp()),
    }
    return jwt.encode(payload, s.secret_key, algorithm=ALGO), jti, exp


def decode_token(token: str, expected_type: str) -> dict:
    try:
        data = jwt.decode(token, get_settings().secret_key, algorithms=[ALGO],
                          options={"require": ["exp", "sub", "type"]})
    except jwt.ExpiredSignatureError:
        raise AppError(401, "TOKEN_EXPIRED", "Sessiya muddati tugadi, qayta kiring") from None
    except jwt.PyJWTError:
        raise AppError(401, "INVALID_TOKEN", "Token yaroqsiz") from None
    if data.get("type") != expected_type:
        raise AppError(401, "INVALID_TOKEN", "Token yaroqsiz")
    return data


# ---------------- request helpers ----------------
def _allowed_origins(request: Request) -> set[str]:
    s = get_settings()
    allowed = set(s.cors_origin_list)
    allowed.add(s.site_url)
    host = request.headers.get("host")
    if host:
        allowed.add(f"http://{host}")
        allowed.add(f"https://{host}")
    return allowed


def check_csrf(request: Request) -> None:
    """For cookie-authenticated writes, require a same-site Origin/Referer when the browser sends one."""
    if request.method not in UNSAFE_METHODS:
        return
    origin = request.headers.get("origin")
    if not origin:
        ref = request.headers.get("referer")
        if ref:
            p = urlparse(ref)
            origin = f"{p.scheme}://{p.netloc}"
    if origin and origin.rstrip("/") not in _allowed_origins(request):
        raise AppError(403, "CSRF_FAILED", "So'rov manbasi ruxsat etilmagan")


def get_token_from_request(request: Request) -> tuple[str | None, bool]:
    """Returns (token, from_cookie)."""
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer "):
        return auth[7:].strip(), False
    tok = request.cookies.get(ACCESS_COOKIE)
    return (tok, True) if tok else (None, False)


_bearer = HTTPBearer(auto_error=False, description="Access token (yoki ss_access cookie)")


def get_current_user(request: Request, db: Session = Depends(get_db),
                     _creds: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> User:
    token, from_cookie = get_token_from_request(request)
    if not token:
        raise AppError(401, "UNAUTHORIZED", "Avval tizimga kiring")
    data = decode_token(token, "access")
    try:
        user = db.get(User, int(data["sub"]))
    except (TypeError, ValueError):
        user = None
    if user is None or not user.is_active:
        raise AppError(401, "UNAUTHORIZED", "Foydalanuvchi topilmadi yoki bloklangan")
    if data.get("ver") != user.token_version:
        raise AppError(401, "TOKEN_REVOKED", "Sessiya bekor qilingan, qayta kiring")
    if from_cookie:
        check_csrf(request)
    request.state.user = user
    return user


def require_role(min_role: str):
    """Dependency: user must have at least `min_role` (manager < admin < super_admin)."""
    need = ROLE_RANK[min_role]

    def _dep(user: User = Depends(get_current_user)) -> User:
        if ROLE_RANK.get(user.role, 0) < need:
            raise AppError(403, "FORBIDDEN", "Bu amal uchun ruxsat yo'q")
        return user

    return _dep


require_manager = require_role("manager")
require_admin = require_role("admin")
require_super_admin = require_role("super_admin")
