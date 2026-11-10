"""Small shared helpers: time zone, phone numbers, localisation, paging, HTML sanitising."""
from __future__ import annotations

import math
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal

import nh3
from sqlalchemy import func, select
from sqlalchemy.orm import Session

# Uzbekistan has no DST; a fixed offset avoids needing tzdata on Windows.
TASHKENT = timezone(timedelta(hours=5), name="Asia/Tashkent")

LANGS = ("uz", "ru", "en")
Lang = Literal["uz", "ru", "en"]


def now_local() -> datetime:
    return datetime.now(TASHKENT)


def today_local() -> date:
    return now_local().date()


def to_local_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(TASHKENT).isoformat(timespec="seconds")


def assume_local(dt: datetime | None) -> datetime | None:
    """Naive datetimes coming from forms are Tashkent local time."""
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=TASHKENT)
    return dt


def date_iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def local_day_bounds_utc(d: date) -> tuple[datetime, datetime]:
    start = datetime(d.year, d.month, d.day, tzinfo=TASHKENT)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


# ---------------- phone ----------------
_PHONE_RE = re.compile(r"^\+998\d{9}$")


def normalize_uz_phone(raw: str) -> str:
    """'+998 90 123-45-67' / '998901234567' / '90 123 45 67' -> '+998901234567'."""
    if raw is None:
        raise ValueError("Telefon raqamini kiriting")
    s = re.sub(r"[\s\-\(\)\.]", "", str(raw))
    if s.startswith("00998"):
        s = "+" + s[2:]
    if s.startswith("998") and len(s) == 12:
        s = "+" + s
    if re.fullmatch(r"\d{9}", s):
        s = "+998" + s
    if not _PHONE_RE.match(s):
        raise ValueError("Telefon raqami +998XXXXXXXXX formatida bo'lishi kerak")
    return s


def format_uz_phone(p: str) -> str:
    if p and _PHONE_RE.match(p):
        return f"{p[:4]} {p[4:6]} {p[6:9]} {p[9:11]} {p[11:13]}"
    return p


# ---------------- localisation ----------------
def pick(obj: Any, field: str, lang: str) -> Any:
    """Return obj.<field>_<lang>, falling back to obj.<field>_uz when empty."""
    val = getattr(obj, f"{field}_{lang}", None)
    if val in (None, "", [], {}):
        val = getattr(obj, f"{field}_uz", None)
    return val


def merge_fallback(base: Any, override: Any) -> Any:
    """Deep merge: values from `override` win unless empty; `base` (uz) fills the gaps."""
    if override in (None, "", [], {}):
        return base
    if isinstance(base, dict) and isinstance(override, dict):
        out = dict(base)
        for k, v in override.items():
            out[k] = merge_fallback(base.get(k), v)
        return out
    if isinstance(base, list) and isinstance(override, list):
        if len(base) == len(override):
            return [merge_fallback(b, o) for b, o in zip(base, override, strict=True)]
        return override
    return override


def lang_or_default(lang: str | None) -> str:
    return lang if lang in LANGS else "uz"


# ---------------- paging ----------------
def paginate(db: Session, stmt, page: int, page_size: int, mapper) -> dict:
    page = max(1, page)
    page_size = max(1, min(page_size, 100))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return {
        "items": [mapper(r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, math.ceil(total / page_size)) if total else 0,
    }


def page_dict(items: list, total: int, page: int, page_size: int) -> dict:
    return {"items": items, "total": total, "page": page, "page_size": page_size,
            "pages": max(1, math.ceil(total / page_size)) if total else 0}


# ---------------- text ----------------
_TRANSLIT = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "j", "з": "z",
    "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "x", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh",
    "ъ": "", "ы": "i", "ь": "", "э": "e", "ю": "yu", "я": "ya", "ў": "o", "қ": "q", "ғ": "g",
    "ҳ": "h", "'": "", "‘": "", "’": "", "ʻ": "", "ʼ": "", "`": "",
})


def slugify(text: str, max_len: int = 80) -> str:
    s = (text or "").lower().translate(_TRANSLIT)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:max_len].strip("-") or "post"


ALLOWED_TAGS = {
    "p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "blockquote",
    "ul", "ol", "li", "a", "img", "figure", "figcaption", "table", "thead", "tbody", "tr",
    "th", "td", "span", "code", "pre",
}
ALLOWED_ATTRS = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height", "loading"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
}


def sanitize_html(html: str | None) -> str:
    if not html:
        return ""
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener noreferrer",
        strip_comments=True,
    )


def strip_html(html: str | None) -> str:
    if not html:
        return ""
    text = nh3.clean(html, tags=set())
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;|&#34;", '"', text)
    text = re.sub(r"&#39;", "'", text)
    return re.sub(r"\s+", " ", text).strip()


def excerpt_from(html: str | None, length: int = 180) -> str:
    text = strip_html(html)
    if len(text) <= length:
        return text
    cut = text[:length].rsplit(" ", 1)[0]
    return cut.rstrip(",.;:") + "…"


def sanitize_blocks(value: Any, key: str | None = None) -> Any:
    """Sanitise HTML inside page blocks (only keys named body/html); other strings stay plain."""
    if isinstance(value, dict):
        return {k: sanitize_blocks(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [sanitize_blocks(v, key) for v in value]
    if isinstance(value, str) and key in ("body", "html"):
        return sanitize_html(value)
    return value
