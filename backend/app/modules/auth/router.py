"""Staff authentication, 2FA, user management (super_admin), staff list and audit log."""
from __future__ import annotations

import time

import pyotp
import segno
from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session

from app.core.audit import audit, diff, snapshot
from app.core.config import get_settings
from app.core.db import get_db, utcnow
from app.core.errors import AppError
from app.core.ratelimit import client_ip, enforce
from app.core.security import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    REFRESH_COOKIE_PATH,
    create_access_token,
    create_refresh_token,
    decode_token,
    dummy_verify,
    get_current_user,
    hash_password,
    require_admin,
    require_manager,
    require_super_admin,
    validate_password_strength,
    verify_password,
)
from app.core.utils import paginate, to_local_iso
from app.modules.auth.models import AuditLog, RefreshToken, User
from app.modules.auth.schemas import (
    ChangePasswordIn,
    LoginIn,
    OtpIn,
    RefreshIn,
    UserCreate,
    UserUpdate,
    user_out,
    user_ref,
)

router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/admin", tags=["admin: users"])


# ---------------- helpers ----------------
def _set_auth_cookies(response: Response, access: str, refresh: str | None) -> None:
    s = get_settings()
    response.set_cookie(ACCESS_COOKIE, access, max_age=s.access_token_minutes * 60, httponly=True,
                        secure=s.secure_cookies, samesite="lax", path="/")
    if refresh:
        response.set_cookie(REFRESH_COOKIE, refresh, max_age=s.refresh_token_days * 86400, httponly=True,
                            secure=s.secure_cookies, samesite="lax", path=REFRESH_COOKIE_PATH)


def _clear_auth_cookies(response: Response) -> None:
    s = get_settings()
    response.delete_cookie(ACCESS_COOKIE, path="/", secure=s.secure_cookies, httponly=True, samesite="lax")
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, secure=s.secure_cookies,
                           httponly=True, samesite="lax")


def _issue(db: Session, user: User, request: Request, response: Response) -> dict:
    access, ttl = create_access_token(user)
    refresh, jti, exp = create_refresh_token(user)
    db.add(RefreshToken(jti=jti, user_id=user.id, expires_at=exp,
                        user_agent=(request.headers.get("user-agent") or "")[:255], ip=client_ip(request)))
    _set_auth_cookies(response, access, refresh)
    return {"access_token": access, "token_type": "bearer", "expires_in": ttl,
            "user": user_out(user), "requires_2fa": False}


def _revoke_all(db: Session, user_id: int) -> None:
    db.execute(update(RefreshToken)
               .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
               .values(revoked_at=utcnow()))


def _verify_totp(user: User, secret: str | None, otp: str | None) -> bool:
    """Checks a 6-digit code (±30 s) and refuses re-use of an already used code."""
    if not secret or not otp:
        return False
    otp = otp.strip().replace(" ", "")
    totp = pyotp.TOTP(secret)
    now = time.time()
    step_now = int(now // 30)
    for offset in (0, -1, 1):
        step = step_now + offset
        if totp.at(step * 30) == otp:
            if user.totp_last_step is not None and step <= user.totp_last_step:
                return False
            user.totp_last_step = step
            return True
    return False


# ---------------- auth ----------------
@router.post("/login", summary="Xodim kirishi")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce(request, "login-ip", 20, 15 * 60)
    enforce(request, "login-email", 8, 15 * 60, key_extra=body.email)
    user = db.scalar(select(User).where(func.lower(User.email) == body.email))
    if user is None:
        dummy_verify()
        raise AppError(401, "INVALID_CREDENTIALS", "Email yoki parol noto'g'ri")
    if not verify_password(body.password, user.password_hash):
        audit(db, user, "login_failed", "user", user.id, None, request)
        db.commit()
        raise AppError(401, "INVALID_CREDENTIALS", "Email yoki parol noto'g'ri")
    if not user.is_active:
        raise AppError(403, "USER_DISABLED", "Hisob bloklangan. Administratorga murojaat qiling")
    if user.two_fa_enabled:
        if not body.otp:
            raise AppError(401, "OTP_REQUIRED", "Ikki bosqichli tasdiqlash kodini kiriting",
                           extra={"requires_2fa": True})
        if not _verify_totp(user, user.totp_secret, body.otp):
            db.commit()
            raise AppError(401, "INVALID_OTP", "Tasdiqlash kodi noto'g'ri", extra={"requires_2fa": True})
    user.last_login_at = utcnow()
    result = _issue(db, user, request, response)
    audit(db, user, "login", "user", user.id, None, request)
    db.commit()
    return result


@router.post("/refresh", summary="Access tokenni yangilash (refresh cookie)")
def refresh(request: Request, response: Response, body: RefreshIn | None = None,
            db: Session = Depends(get_db)):
    enforce(request, "refresh", 60, 60)
    token = request.cookies.get(REFRESH_COOKIE) or (body.refresh_token if body else None)
    if not token:
        raise AppError(401, "NO_REFRESH_TOKEN", "Sessiya topilmadi, qayta kiring")
    try:
        data = decode_token(token, "refresh")
    except AppError:
        _clear_auth_cookies(response)
        raise
    row = db.scalar(select(RefreshToken).where(RefreshToken.jti == data.get("jti")))
    user = db.get(User, int(data["sub"]))
    if row is None or user is None:
        raise AppError(401, "INVALID_TOKEN", "Sessiya yaroqsiz, qayta kiring")
    if row.revoked_at is not None:
        # A rotated token was used again -> possible theft: end every session of this user.
        _revoke_all(db, user.id)
        db.commit()
        raise AppError(401, "TOKEN_REUSED", "Sessiya bekor qilindi, qayta kiring")
    if not user.is_active or data.get("ver") != user.token_version:
        raise AppError(401, "TOKEN_REVOKED", "Sessiya bekor qilingan, qayta kiring")
    row.revoked_at = utcnow()
    result = _issue(db, user, request, response)
    db.commit()
    return result


@router.post("/logout", summary="Chiqish")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(REFRESH_COOKIE)
    if token:
        try:
            data = decode_token(token, "refresh")
            row = db.scalar(select(RefreshToken).where(RefreshToken.jti == data.get("jti")))
            if row and row.revoked_at is None:
                row.revoked_at = utcnow()
                db.commit()
        except AppError:
            pass
    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", summary="Joriy foydalanuvchi")
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.post("/2fa/setup", summary="2FA: QR kod olish")
def twofa_setup(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.two_fa_enabled:
        raise AppError(409, "TWO_FA_ALREADY_ENABLED", "2FA allaqachon yoqilgan")
    secret = pyotp.random_base32()
    user.totp_pending_secret = secret
    db.commit()
    url = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name="Smart Start")
    qr_svg = segno.make(url, error="m").svg_inline(scale=5, dark="#13294B", light="#ffffff")
    return {"secret": secret, "otpauth_url": url, "qr_svg": qr_svg}


@router.post("/2fa/enable", summary="2FA: yoqish")
def twofa_enable(body: OtpIn, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    if not user.totp_pending_secret:
        raise AppError(400, "TWO_FA_NOT_SETUP", "Avval /auth/2fa/setup ni chaqiring")
    if not _verify_totp(user, user.totp_pending_secret, body.otp):
        db.commit()
        raise AppError(400, "INVALID_OTP", "Tasdiqlash kodi noto'g'ri")
    user.totp_secret = user.totp_pending_secret
    user.totp_pending_secret = None
    user.two_fa_enabled = True
    audit(db, user, "2fa_enable", "user", user.id, None, request)
    db.commit()
    return user_out(user)


@router.post("/2fa/disable", summary="2FA: o'chirish")
def twofa_disable(body: OtpIn, request: Request, db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    if not user.two_fa_enabled:
        raise AppError(400, "TWO_FA_NOT_ENABLED", "2FA yoqilmagan")
    if not _verify_totp(user, user.totp_secret, body.otp):
        db.commit()
        raise AppError(400, "INVALID_OTP", "Tasdiqlash kodi noto'g'ri")
    user.two_fa_enabled = False
    user.totp_secret = None
    user.totp_last_step = None
    audit(db, user, "2fa_disable", "user", user.id, None, request)
    db.commit()
    return user_out(user)


@router.post("/change-password", summary="Parolni o'zgartirish")
def change_password(body: ChangePasswordIn, request: Request, response: Response,
                    db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    enforce(request, "change-password", 10, 15 * 60, key_extra=str(user.id))
    if not verify_password(body.current_password, user.password_hash):
        raise AppError(400, "INVALID_PASSWORD", "Joriy parol noto'g'ri")
    validate_password_strength(body.new_password)
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1
    _revoke_all(db, user.id)
    result = _issue(db, user, request, response)  # keep this browser signed in
    audit(db, user, "change_password", "user", user.id, None, request)
    db.commit()
    return result


# ---------------- staff list (for assigning admissions) ----------------
@users_router.get("/staff", summary="Faol xodimlar ro'yxati (mas'ul tanlash uchun)")
def staff_list(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    rows = db.scalars(select(User).where(User.is_active.is_(True)).order_by(User.full_name)).all()
    return [{"id": u.id, "full_name": u.full_name, "role": u.role} for u in rows]


# ---------------- users (super_admin) ----------------
def _get_user(db: Session, user_id: int) -> User:
    u = db.get(User, user_id)
    if u is None:
        raise AppError(404, "NOT_FOUND", "Foydalanuvchi topilmadi")
    return u


def _other_super_admins(db: Session, exclude_id: int) -> int:
    return db.scalar(select(func.count()).select_from(User).where(
        User.role == "super_admin", User.is_active.is_(True), User.id != exclude_id)) or 0


@users_router.get("/users", summary="Xodimlar")
def list_users(search: str | None = Query(None, max_length=100), page: int = Query(1, ge=1),
               page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
               _: User = Depends(require_super_admin)):
    stmt = select(User).order_by(User.id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.full_name.ilike(like)))
    return paginate(db, stmt, page, page_size, user_out)


@users_router.post("/users", status_code=201, summary="Xodim qo'shish")
def create_user(body: UserCreate, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(require_super_admin)):
    validate_password_strength(body.password)
    if db.scalar(select(User).where(func.lower(User.email) == body.email)):
        raise AppError(409, "EMAIL_TAKEN", "Bu email bilan foydalanuvchi mavjud")
    u = User(email=body.email, full_name=body.full_name.strip(), role=body.role, is_active=body.is_active,
             password_hash=hash_password(body.password))
    db.add(u)
    db.flush()
    audit(db, actor, "create", "user", u.id, {"after": snapshot(u)}, request)
    db.commit()
    return user_out(u)


@users_router.get("/users/{user_id}", summary="Xodim")
def get_user(user_id: int, db: Session = Depends(get_db), _: User = Depends(require_super_admin)):
    return user_out(_get_user(db, user_id))


@users_router.put("/users/{user_id}", summary="Xodimni tahrirlash")
def update_user(user_id: int, body: UserUpdate, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(require_super_admin)):
    u = _get_user(db, user_id)
    before = snapshot(u)
    data = body.model_dump(exclude_unset=True)
    if u.id == actor.id and (data.get("is_active") is False or
                             (data.get("role") and data["role"] != "super_admin")):
        raise AppError(400, "CANNOT_DEMOTE_SELF", "O'zingizni bloklay yoki rolingizni pasaytira olmaysiz")
    if u.role == "super_admin" and (data.get("is_active") is False or
                                    (data.get("role") and data["role"] != "super_admin")):
        if _other_super_admins(db, u.id) == 0:
            raise AppError(400, "LAST_SUPER_ADMIN", "Kamida bitta faol super admin qolishi kerak")
    if "email" in data and data["email"] and data["email"] != u.email:
        if db.scalar(select(User).where(func.lower(User.email) == data["email"], User.id != u.id)):
            raise AppError(409, "EMAIL_TAKEN", "Bu email bilan foydalanuvchi mavjud")
        u.email = data["email"]
    if data.get("full_name"):
        u.full_name = data["full_name"].strip()
    revoke = False
    if data.get("password"):
        validate_password_strength(data["password"])
        u.password_hash = hash_password(data["password"])
        revoke = True
    if data.get("role") and data["role"] != u.role:
        u.role = data["role"]
        revoke = True
    if data.get("is_active") is not None and data["is_active"] != u.is_active:
        u.is_active = data["is_active"]
        revoke = revoke or not u.is_active
    if data.get("two_fa_enabled") is False and u.two_fa_enabled:
        u.two_fa_enabled = False
        u.totp_secret = None
        u.totp_last_step = None
    if revoke:
        u.token_version += 1
        _revoke_all(db, u.id)
    changes = diff(before, snapshot(u))
    if data.get("password"):
        changes["password"] = "changed"
    if changes:
        audit(db, actor, "update", "user", u.id, {"changes": changes}, request)
    db.commit()
    return user_out(u)


@users_router.delete("/users/{user_id}", status_code=204, summary="Xodimni o'chirish")
def delete_user(user_id: int, request: Request, db: Session = Depends(get_db),
                actor: User = Depends(require_super_admin)):
    u = _get_user(db, user_id)
    if u.id == actor.id:
        raise AppError(400, "CANNOT_DELETE_SELF", "O'zingizni o'chira olmaysiz")
    if u.role == "super_admin" and _other_super_admins(db, u.id) == 0:
        raise AppError(400, "LAST_SUPER_ADMIN", "Kamida bitta faol super admin qolishi kerak")
    snap = snapshot(u)
    db.delete(u)
    audit(db, actor, "delete", "user", user_id, {"before": snap}, request)
    db.commit()
    return Response(status_code=204)


# ---------------- audit log ----------------
@users_router.get("/audit-log", summary="Audit jurnali")
def audit_log(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
              entity: str | None = None, entity_id: int | None = None, user_id: int | None = None,
              action: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    stmt = select(AuditLog).order_by(AuditLog.id.desc())
    if entity:
        stmt = stmt.where(AuditLog.entity == entity)
    if entity_id is not None:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)
    if action:
        stmt = stmt.where(AuditLog.action == action)

    def _row(a: AuditLog) -> dict:
        return {"id": a.id, "user": user_ref(a.user), "action": a.action, "entity": a.entity,
                "entity_id": a.entity_id, "details": a.details, "ip": a.ip,
                "created_at": to_local_iso(a.created_at)}

    return paginate(db, stmt, page, page_size, _row)
