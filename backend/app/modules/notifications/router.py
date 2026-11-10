from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import require_admin
from app.core.utils import to_local_iso
from app.modules.auth.models import User
from app.modules.notifications import service
from app.modules.notifications.models import NotificationLog

public_router = APIRouter(prefix="/public", tags=["public: settings"])
admin_router = APIRouter(prefix="/admin/settings", tags=["admin: settings"])


@public_router.get("/settings", summary="Sayt sozlamalari (analitika ID, kontaktlar)")
def public_settings(db: Session = Depends(get_db)):
    eff = service.get_effective(db)
    return {k: eff.get(k) or "" for k in service.PUBLIC_KEYS}


class SettingsIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    site_name: str | None = Field(None, max_length=100)
    telegram_bot_token: str | None = Field(None, max_length=200)
    telegram_chat_id: str | None = Field(None, max_length=300)
    telegram_enabled: bool | None = None
    sms_enabled: bool | None = None
    eskiz_email: str | None = Field(None, max_length=200)
    eskiz_password: str | None = Field(None, max_length=200)
    eskiz_from: str | None = Field(None, max_length=20)
    turnstile_site_key: str | None = Field(None, max_length=200)
    turnstile_secret: str | None = Field(None, max_length=200)
    ga4_id: str | None = Field(None, max_length=50)
    ym_id: str | None = Field(None, max_length=50)
    meta_pixel_id: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=50)
    telegram: str | None = Field(None, max_length=200)
    instagram: str | None = Field(None, max_length=200)
    address: str | None = Field(None, max_length=300)


@admin_router.get("", summary="Sozlamalar (maxfiy qiymatlar yashirilgan)")
def get_settings_admin(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return service.settings_for_admin(db)


@admin_router.put("", summary="Sozlamalarni saqlash")
def put_settings_admin(body: SettingsIn, request: Request, db: Session = Depends(get_db),
                       user: User = Depends(require_admin)):
    data = {k: (v.strip() if isinstance(v, str) else v) for k, v in body.model_dump(exclude_unset=True).items()}
    changed = service.update_settings(db, data)
    if changed:
        audit(db, user, "update", "settings", None, {"changes": changed}, request)
    db.commit()
    return service.settings_for_admin(db)


@admin_router.post("/telegram/test", summary="Telegram botni sinash")
def telegram_test(db: Session = Depends(get_db), user: User = Depends(require_admin)):
    cfg = service.get_effective(db)
    if not cfg.get("telegram_bot_token") or not cfg.get("telegram_chat_id"):
        raise AppError(400, "TELEGRAM_NOT_CONFIGURED", "Avval bot token va chat ID ni kiriting")
    ok, err = service.telegram_send(
        cfg["telegram_bot_token"], cfg["telegram_chat_id"],
        f"✅ <b>Smart Start</b>: test xabari.\nYuboruvchi: {service.e(user.full_name)}")
    if not ok:
        raise AppError(502, "TELEGRAM_ERROR", f"Telegram xabar yubormadi: {err}")
    return {"ok": True, "message": "Test xabari yuborildi"}


@admin_router.get("/notifications", summary="Oxirgi bildirishnomalar jurnali")
def notification_log(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.scalars(select(NotificationLog).order_by(NotificationLog.id.desc()).limit(50)).all()
    return [{"id": r.id, "channel": r.channel, "event": r.event, "ok": r.ok, "error": r.error,
             "created_at": to_local_iso(r.created_at)} for r in rows]
