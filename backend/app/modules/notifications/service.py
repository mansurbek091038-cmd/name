"""Runtime settings, Telegram, Eskiz SMS and Cloudflare Turnstile integrations."""
from __future__ import annotations

import html
import logging
import threading
import time
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.errors import AppError
from app.core.utils import format_uz_phone, to_local_iso
from app.modules.notifications.models import NotificationLog, SiteSetting

log = logging.getLogger("smartstart.notify")

# key -> (type, default-from-env attribute or literal)
SETTING_KEYS: dict[str, tuple[type, Any]] = {
    "site_name": (str, "Smart Start"),
    "telegram_bot_token": (str, "env:telegram_bot_token"),
    "telegram_chat_id": (str, "env:telegram_chat_id"),
    "telegram_enabled": (bool, "env:telegram_enabled"),
    "sms_enabled": (bool, "env:sms_enabled"),
    "eskiz_email": (str, "env:eskiz_email"),
    "eskiz_password": (str, "env:eskiz_password"),
    "eskiz_from": (str, "env:eskiz_from"),
    "turnstile_site_key": (str, "env:turnstile_site_key"),
    "turnstile_secret": (str, "env:turnstile_secret"),
    "ga4_id": (str, "env:ga4_id"),
    "ym_id": (str, "env:ym_id"),
    "meta_pixel_id": (str, "env:meta_pixel_id"),
    "phone": (str, "+998 98 560 07 20"),
    "telegram": (str, ""),
    "instagram": (str, ""),
    "address": (str, "120100, Sirdaryo viloyati, Guliston, Al-Xorazmiy ko‘chasi, 36"),
    "work_hours_weekday": (str, "Du–Ju: 08:30–17:30"),
    "work_hours_saturday": (str, "Sha: 08:30–12:00"),
    "working_hours": (str, "Du–Ju: 08:30–17:30, Sha: 08:30–12:00"),
}
SECRET_KEYS = ("telegram_bot_token", "eskiz_password", "turnstile_secret")
PUBLIC_KEYS = ("site_name", "phone", "telegram", "instagram", "address",
               "work_hours_weekday", "work_hours_saturday", "working_hours",
               "turnstile_site_key", "ga4_id", "ym_id", "meta_pixel_id")


def _default(key: str) -> Any:
    _, d = SETTING_KEYS[key]
    if isinstance(d, str) and d.startswith("env:"):
        return getattr(get_settings(), d[4:])
    return d


def get_effective(db: Session) -> dict[str, Any]:
    stored = {r.key: r.value for r in db.scalars(select(SiteSetting)).all()}
    out = {}
    for key, (typ, default) in SETTING_KEYS.items():
        val = stored.get(key)
        from_env = isinstance(default, str) and default.startswith("env:")
        # Integration keys: an empty admin value falls back to .env.
        # Plain site fields: an explicit "" from the admin means "cleared".
        if val is None or (from_env and typ is str and val == ""):
            val = _default(key)
        out[key] = typ(val) if val is not None else val
    return out


def mask(value: str) -> str:
    if not value:
        return ""
    return "••••••" + value[-4:] if len(value) > 6 else "••••••"


def is_masked(value: Any) -> bool:
    return isinstance(value, str) and "••" in value


def settings_for_admin(db: Session) -> dict:
    eff = get_effective(db)
    out = dict(eff)
    for k in SECRET_KEYS:
        out[f"{k}_set"] = bool(eff.get(k))
        out[k] = mask(eff.get(k) or "")
    return out


def update_settings(db: Session, data: dict) -> dict:
    changed = {}
    for key, value in data.items():
        if key not in SETTING_KEYS:
            continue
        if key in SECRET_KEYS and is_masked(value):
            continue  # unchanged masked placeholder sent back by the form
        row = db.get(SiteSetting, key)
        if row is None:
            row = SiteSetting(key=key, value=value)
            db.add(row)
        else:
            row.value = value
        changed[key] = "••••" if key in SECRET_KEYS else value
    return changed


# ---------------- Telegram ----------------
def _log(channel: str, event: str, ok: bool, error: str = "") -> None:
    try:
        with SessionLocal() as db:
            db.add(NotificationLog(channel=channel, event=event, ok=ok, error=error[:500]))
            db.commit()
    except Exception:  # pragma: no cover
        log.exception("Could not write notification log")


def telegram_send(token: str, chat_ids: str, text: str, reply_markup: dict | None = None) -> tuple[bool, str]:
    ids = [c.strip() for c in (chat_ids or "").replace(";", ",").split(",") if c.strip()]
    if not token or not ids:
        return False, "Bot token yoki chat ID kiritilmagan"
    ok_any, last_err = False, ""
    with httpx.Client(timeout=10) as client:
        for cid in ids:
            payload: dict[str, Any] = {"chat_id": cid, "text": text, "parse_mode": "HTML",
                                       "disable_web_page_preview": True}
            if reply_markup:
                payload["reply_markup"] = reply_markup
            try:
                r = client.post(f"https://api.telegram.org/bot{token}/sendMessage", json=payload)
                data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
                if r.status_code == 200 and data.get("ok"):
                    ok_any = True
                else:
                    last_err = str(data.get("description") or f"HTTP {r.status_code}")
                    log.warning("Telegram send to %s failed: %s", cid, last_err)
            except httpx.HTTPError as e:
                last_err = f"Tarmoq xatosi: {e.__class__.__name__}"
                log.warning("Telegram send to %s failed: %s", cid, e)
    return ok_any, last_err


def _admin_button(path: str) -> dict | None:
    site = get_settings().site_url
    if not site.startswith("https://"):
        return None  # Telegram rejects non-https / localhost button URLs
    return {"inline_keyboard": [[{"text": "🔗 Admin panelda ochish", "url": f"{site}{path}"}]]}


def _send_telegram_event(event: str, text: str, button_path: str | None = None) -> None:
    with SessionLocal() as db:
        cfg = get_effective(db)
    if not cfg.get("telegram_enabled") or not cfg.get("telegram_bot_token") or not cfg.get("telegram_chat_id"):
        log.info("Telegram not configured; skipping %s", event)
        return
    ok, err = telegram_send(cfg["telegram_bot_token"], cfg["telegram_chat_id"], text,
                            _admin_button(button_path) if button_path else None)
    _log("telegram", event, ok, err)


def e(v: Any) -> str:
    return html.escape(str(v if v not in (None, "") else "—"))


def notify_new_admission(admission_id: int) -> None:
    """Background task: tell the managers' Telegram group about a new application."""
    try:
        from app.modules.admissions.models import Admission

        with SessionLocal() as db:
            a = db.get(Admission, admission_id)
            if a is None:
                return
            src = a.utm_source or "sayt"
            if a.utm_campaign:
                src += f" / {a.utm_campaign}"
            text = (
                "🔔 <b>YANGI QABUL ARIZASI!</b>\n"
                "🏫 <b>Smart Start Xususiy Maktabi</b>\n\n"
                f"👤 <b>Ota-ona:</b> {e(a.parent_name)}\n"
                f"🎓 <b>O'quvchi:</b> {e(a.child_name)}"
                + (f" ({e(a.birth_year)} y.)" if a.birth_year else "") + "\n"
                f"📞 <b>Telefon:</b> <code>{e(format_uz_phone(a.phone))}</code>\n"
                f"🏫 <b>Sinf:</b> {e(a.target_grade)}-sinf\n"
                f"📝 <b>Izoh:</b> {e(a.comment or 'Kiritilmagan')}\n"
                f"📣 <b>Manba:</b> {e(src)}\n"
                f"📅 <b>Vaqt:</b> {e(to_local_iso(a.created_at)[:16].replace('T', ' '))}\n"
                f"🆔 <b>Ariza raqami:</b> <code>{e(a.number)}</code>\n"
                "📌 <b>Holat:</b> 🟡 Yangi"
            )
            aid = a.id
        _send_telegram_event("admission", text, f"/admin/admissions/{aid}")
    except Exception:
        log.exception("notify_new_admission failed")


def notify_tour_booking(booking_id: int) -> None:
    try:
        from app.modules.events.models import TourBooking

        with SessionLocal() as db:
            b = db.get(TourBooking, booking_id)
            if b is None:
                return
            t = b.tour
            booked = len(t.bookings)
            kind = "Ochiq eshiklar kuni" if t.type == "ochiq_eshiklar" else "Ekskursiya"
            text = (
                "🗓 <b>EKSKURSIYAGA YOZILISH</b>\n"
                "🏫 <b>Smart Start Xususiy Maktabi</b>\n\n"
                f"📍 <b>Tadbir:</b> {e(kind)}\n"
                f"📅 <b>Sana:</b> {e(t.date.strftime('%d.%m.%Y'))} {e(t.time.strftime('%H:%M'))}\n"
                f"👤 <b>Ota-ona:</b> {e(b.parent_name)}\n"
                f"📞 <b>Telefon:</b> <code>{e(format_uz_phone(b.phone))}</code>\n"
                f"👧 <b>Bolalar soni:</b> {e(b.children_count)}\n"
                f"🎟 <b>Band joylar:</b> {booked} / {t.capacity}"
            )
            tid = t.id
        _send_telegram_event("tour_booking", text, f"/admin/tours/{tid}")
    except Exception:
        log.exception("notify_tour_booking failed")


def notify_course_enrollment(enrollment_id: int) -> None:
    try:
        from app.modules.courses.models import CourseEnrollment

        with SessionLocal() as db:
            enr = db.get(CourseEnrollment, enrollment_id)
            if enr is None:
                return
            course_title = enr.course_title or (enr.course.title_uz if enr.course else "Kurs")
            text = (
                "📚 <b>YANGI KURSGA YOZILISH</b>\n"
                "🏫 <b>Smart Start Xususiy Maktabi</b>\n\n"
                f"🎯 <b>Kurs:</b> {e(course_title)}\n"
                f"👤 <b>Foydalanuvchi:</b> {e(enr.name)}\n"
                f"📞 <b>Telefon:</b> <code>{e(format_uz_phone(enr.phone))}</code>"
            )
            if enr.comment:
                text += f"\n💬 <b>Izoh:</b> {e(enr.comment)}"
        _send_telegram_event("course_enrollment", text, "/admin/kurslar")
    except Exception:
        log.exception("notify_course_enrollment failed")


def notify_contact(message_id: int) -> None:
    try:
        from app.modules.admissions.models import ContactMessage

        with SessionLocal() as db:
            m = db.get(ContactMessage, message_id)
            if m is None:
                return
            text = (
                "✉️ <b>SAYTDAN XABAR (Aloqa formasi)</b>\n\n"
                f"👤 <b>Ism:</b> {e(m.name)}\n"
                f"📞 <b>Telefon:</b> <code>{e(format_uz_phone(m.phone))}</code>\n"
                f"💬 <b>Xabar:</b> {e(m.message)}"
            )
        _send_telegram_event("contact", text)
    except Exception:
        log.exception("notify_contact failed")


# ---------------- Eskiz SMS ----------------
ESKIZ_BASE = "https://notify.eskiz.uz/api"
_eskiz_lock = threading.Lock()
_eskiz_token: dict[str, Any] = {"token": None, "email": None, "at": 0.0}


def _eskiz_login(client: httpx.Client, email: str, password: str) -> str:
    r = client.post(f"{ESKIZ_BASE}/auth/login", data={"email": email, "password": password})
    r.raise_for_status()
    token = (r.json().get("data") or {}).get("token")
    if not token:
        raise RuntimeError("Eskiz login: token yo'q")
    _eskiz_token.update(token=token, email=email, at=time.time())
    return token


def send_sms(phone: str, message: str) -> tuple[bool, str]:
    with SessionLocal() as db:
        cfg = get_effective(db)
    if not cfg.get("sms_enabled") or not cfg.get("eskiz_email") or not cfg.get("eskiz_password"):
        return False, "SMS sozlanmagan"
    mobile = phone.lstrip("+")
    try:
        with _eskiz_lock, httpx.Client(timeout=15) as client:
            token = _eskiz_token["token"]
            # Eskiz tokens live ~30 days; refresh after 25.
            if not token or _eskiz_token["email"] != cfg["eskiz_email"] or time.time() - _eskiz_token["at"] > 25 * 86400:
                token = _eskiz_login(client, cfg["eskiz_email"], cfg["eskiz_password"])
            payload = {"mobile_phone": mobile, "message": message, "from": cfg.get("eskiz_from") or "4546"}
            r = client.post(f"{ESKIZ_BASE}/message/sms/send", data=payload,
                            headers={"Authorization": f"Bearer {token}"})
            if r.status_code == 401:
                token = _eskiz_login(client, cfg["eskiz_email"], cfg["eskiz_password"])
                r = client.post(f"{ESKIZ_BASE}/message/sms/send", data=payload,
                                headers={"Authorization": f"Bearer {token}"})
            if r.status_code >= 400:
                return False, f"Eskiz HTTP {r.status_code}: {r.text[:200]}"
            return True, ""
    except Exception as ex:  # network / auth errors must never break the request
        log.warning("Eskiz SMS failed: %s", ex)
        return False, str(ex)[:300]


def sms_admission_confirmation(admission_id: int) -> None:
    try:
        from app.modules.admissions.models import Admission

        with SessionLocal() as db:
            a = db.get(Admission, admission_id)
            if a is None:
                return
            phone, number = a.phone, a.number
            cfg = get_effective(db)
        if not cfg.get("sms_enabled"):
            return
        msg = (f"Smart Start: arizangiz qabul qilindi ({number}). "
               f"Menejerimiz 1 ish kuni ichida siz bilan bog'lanadi. Tel: {cfg.get('phone')}")
        ok, err = send_sms(phone, msg)
        _log("sms", "admission", ok, err)
    except Exception:
        log.exception("sms_admission_confirmation failed")


# ---------------- Cloudflare Turnstile ----------------
def verify_turnstile(db: Session, token: str | None, ip: str) -> None:
    secret = get_effective(db).get("turnstile_secret")
    if not secret:
        return  # not configured -> skip
    if not token:
        raise AppError(400, "CAPTCHA_REQUIRED", "Spamdan himoya tekshiruvidan o'ting")
    try:
        r = httpx.post("https://challenges.cloudflare.com/turnstile/v0/siteverify",
                       data={"secret": secret, "response": token, "remoteip": ip}, timeout=8)
        data = r.json()
    except Exception as ex:
        # Fail open on network problems so real parents are not blocked; rate limits still apply.
        log.warning("Turnstile verification unavailable: %s", ex)
        return
    if not data.get("success"):
        raise AppError(400, "CAPTCHA_FAILED", "Spamdan himoya tekshiruvi muvaffaqiyatsiz. Qayta urinib ko'ring")
