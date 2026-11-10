"""Audit log helper for admin writes."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import Request
from sqlalchemy.orm import Session

from app.core.ratelimit import client_ip
from app.modules.auth.models import AuditLog, User

SKIP_FIELDS = {"password", "password_hash", "totp_secret", "totp_pending_secret",
               "telegram_bot_token", "eskiz_password", "turnstile_secret"}


def _plain(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, (str, int, float, bool)) or v is None:
        return v
    if isinstance(v, (list, tuple)):
        return [_plain(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _plain(x) for k, x in v.items()}
    return str(v)


def snapshot(obj: Any, fields: list[str] | None = None) -> dict:
    cols = fields or [c.key for c in obj.__table__.columns]
    return {c: _plain(getattr(obj, c, None)) for c in cols if c not in SKIP_FIELDS}


def diff(before: dict, after: dict) -> dict:
    out = {}
    for k, v in after.items():
        if k in SKIP_FIELDS:
            continue
        if before.get(k) != v:
            b = before.get(k)
            # Keep long text diffs small
            if isinstance(b, (str, dict, list)) and len(str(b)) > 300:
                b = "…"
            a = v if not (isinstance(v, (str, dict, list)) and len(str(v)) > 300) else "…"
            out[k] = {"from": b, "to": a}
    return out


def audit(db: Session, user: User | None, action: str, entity: str, entity_id: int | None,
          details: dict | None = None, request: Request | None = None) -> None:
    db.add(AuditLog(
        user_id=user.id if user else None,
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=_plain(details) if details else None,
        ip=client_ip(request) if request else "",
    ))
