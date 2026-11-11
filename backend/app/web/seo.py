"""Server-side SEO for the SPA: per-route <head> tags, JSON-LD, sitemap.xml, robots.txt."""
from __future__ import annotations

import html
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import STATIC_DIR, get_settings
from app.core.db import utcnow
from app.core.utils import (
    LANGS,
    TASHKENT,
    excerpt_from,
    pick,
    to_local_iso,
    today_local,
)
from app.modules.content import service as content_svc
from app.modules.content.models import Page, Post
from app.modules.events.models import Tour
from app.modules.media.schemas import public_media
from app.modules.notifications.service import get_effective

INDEX_FILE = STATIC_DIR / "index.html"

# Known SPA routes -> page key used for SEO texts
ROUTE_PAGES = {
    "/": "home",
    "/natijalar": "results",
    "/qabul": "admission",
    "/aloqa": "contact",
    "/maxfiylik": "privacy",
    "/rahmat": "thanks",
    "/oqituvchilar": None,
    "/yangiliklar": None,
    "/galereya": None,
}
SITEMAP_ROUTES = ["/", "/natijalar", "/qabul", "/oqituvchilar", "/yangiliklar", "/galereya", "/aloqa", "/maxfiylik"]

DEFAULTS = {
    "uz": {
        "site": "Smart Start Xususiy Maktabi",
        "description": "Smart Start — xususiy maktab: zamonaviy ta'lim, kuchli ingliz tili, "
                       "kichik sinflar va tajribali o'qituvchilar. 2026–2027 o'quv yiliga qabul ochiq.",
        "/oqituvchilar": ("O'qituvchilar", "Farzandingizni kimlar o'qitadi: Smart Start tajribali o'qituvchilari."),
        "/yangiliklar": ("Yangiliklar", "Smart Start maktab hayoti: yangiliklar, tadbirlar va e'lonlar."),
        "/galereya": ("Galereya", "Smart Start maktabi suratlarda: bino, sinflar va darslar."),
    },
    "ru": {
        "site": "Частная школа Smart Start",
        "description": "Smart Start — частная школа: современное образование, сильный английский, "
                       "небольшие классы и опытные педагоги. Открыт приём на 2026–2027 учебный год.",
        "/oqituvchilar": ("Учителя", "Кто учит вашего ребёнка: опытные педагоги школы Smart Start."),
        "/yangiliklar": ("Новости", "Жизнь школы Smart Start: новости, события и объявления."),
        "/galereya": ("Галерея", "Школа Smart Start в фотографиях: здание, классы и уроки."),
    },
    "en": {
        "site": "Smart Start Private School",
        "description": "Smart Start is a private school: modern education, strong English, "
                       "small classes and experienced teachers. Admissions open for 2026–2027.",
        "/oqituvchilar": ("Teachers", "Who teaches your child: the experienced faculty of Smart Start."),
        "/yangiliklar": ("News", "Smart Start school life: news, events and announcements."),
        "/galereya": ("Gallery", "Smart Start in pictures: the building, classrooms and lessons."),
    },
}
OG_LOCALE = {"uz": "uz_UZ", "ru": "ru_RU", "en": "en_US"}


@dataclass
class Meta:
    title: str
    description: str
    path: str
    lang: str
    image: str | None = None
    og_type: str = "website"
    jsonld: list[dict] = field(default_factory=list)
    status: int = 200
    noindex: bool = False


# ---------------- index.html cache ----------------
_index_cache: dict[str, tuple[float, str]] = {}


def read_index() -> str | None:
    try:
        mtime = INDEX_FILE.stat().st_mtime
    except FileNotFoundError:
        return None
    cached = _index_cache.get("index")
    if cached and cached[0] == mtime:
        return cached[1]
    text = INDEX_FILE.read_text(encoding="utf-8")
    _index_cache["index"] = (mtime, text)
    return text


def _abs(url: str | None) -> str | None:
    if not url:
        return None
    return url if url.startswith("http") else f"{get_settings().site_url}{url}"


def _url(path: str, lang: str) -> str:
    base = f"{get_settings().site_url}{path}"
    return base if lang == "uz" else f"{base}?lang={lang}"


def _address(cfg: dict, contact: dict) -> dict:
    addr = contact.get("address") or cfg.get("address") or "120100, Sirdaryo viloyati, Guliston, Al-Xorazmiy ko‘chasi, 36"
    return {"@type": "PostalAddress", "streetAddress": addr,
            "postalCode": "120100",
            "addressLocality": "Guliston", "addressRegion": "Sirdaryo viloyati", "addressCountry": "UZ"}


def _school_ld(db: Session, lang: str) -> dict:
    cfg = get_effective(db)
    s = get_settings()
    contact_page = db.scalar(select(Page).where(Page.key == "contact"))
    contact = content_svc.localized_blocks(db, contact_page, lang) if contact_page else {}
    home_page = db.scalar(select(Page).where(Page.key == "home"))
    home = content_svc.localized_blocks(db, home_page, lang) if home_page else {}
    logo = (home.get("logo") or {}).get("url") if isinstance(home.get("logo"), dict) else None
    hero_img = ((home.get("hero") or {}).get("image") or {})
    ld = {
        "@context": "https://schema.org",
        "@type": "School",
        "name": DEFAULTS[lang]["site"],
        "alternateName": "Smart Start",
        "url": s.site_url,
        "telephone": cfg.get("phone") or "",
        "address": _address(cfg, contact),
        "foundingDate": "2022",
        "openingHours": ["Mo-Fr 08:00-18:00", "Sa 09:00-14:00"],
        "description": DEFAULTS[lang]["description"],
    }
    if logo:
        ld["logo"] = _abs(logo)
    if isinstance(hero_img, dict) and hero_img.get("url"):
        ld["image"] = _abs(hero_img.get("large") or hero_img["url"])
    if contact.get("lat") and contact.get("lng"):
        ld["geo"] = {"@type": "GeoCoordinates", "latitude": contact["lat"], "longitude": contact["lng"]}
    same = [u for u in (cfg.get("instagram"), cfg.get("telegram")) if u and u.startswith("http")]
    if same:
        ld["sameAs"] = same
    return ld


def _event_ld(name: str, start: datetime, description: str, url: str, image: str | None,
              address: dict) -> dict:
    ld = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": name,
        "startDate": to_local_iso(start),
        "endDate": to_local_iso(start + timedelta(hours=2)),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
        "location": {"@type": "Place", "name": "Smart Start", "address": address},
        "organizer": {"@type": "Organization", "name": "Smart Start", "url": get_settings().site_url},
        "description": description,
        "url": url,
        "isAccessibleForFree": True,
    }
    if image:
        ld["image"] = [image]
    return ld


def _upcoming_events_ld(db: Session, lang: str) -> list[dict]:
    cfg = get_effective(db)
    address = _address(cfg, {})
    out = []
    now = utcnow()
    posts = db.scalars(select(Post).where(Post.type == "event", Post.event_date.is_not(None),
                                          Post.event_date >= now, Post.published_at.is_not(None),
                                          Post.published_at <= now).order_by(Post.event_date).limit(5)).all()
    for p in posts:
        cover = public_media(db, p.cover_id, lang)
        out.append(_event_ld(pick(p, "title", lang), p.event_date,
                             pick(p, "excerpt", lang) or excerpt_from(pick(p, "body", lang)),
                             _url(f"/yangiliklar/{p.slug}", lang), _abs(cover["large"]) if cover else None, address))
    names = {"uz": "Ochiq eshiklar kuni — Smart Start", "ru": "День открытых дверей — Smart Start",
             "en": "Open Day — Smart Start"}
    tours = db.scalars(select(Tour).where(Tour.type == "ochiq_eshiklar", Tour.is_active.is_(True),
                                          Tour.date >= today_local()).order_by(Tour.date).limit(3)).all()
    for t in tours:
        start = datetime.combine(t.date, t.time, tzinfo=TASHKENT)
        out.append(_event_ld(names[lang], start, DEFAULTS[lang]["description"], _url("/qabul", lang), None, address))
    return out


def build_meta(db: Session, path: str, lang: str) -> Meta:
    lang = lang if lang in LANGS else "uz"
    d = DEFAULTS[lang]
    path = "/" + path.strip("/") if path.strip("/") else "/"
    meta = Meta(title=d["site"], description=d["description"], path=path, lang=lang)

    if path.startswith("/yangiliklar/"):
        slug = path.split("/", 2)[2]
        post = db.scalar(select(Post).where(Post.slug == slug))
        if post is None or not content_svc.is_published(post):
            meta.title = f"404 — {d['site']}"
            meta.status = 404
            return meta
        detail = content_svc.post_detail(db, post, lang)
        meta.title = f"{detail['title']} — {d['site']}"
        meta.description = detail["excerpt"] or d["description"]
        meta.og_type = "article"
        if detail["cover"]:
            meta.image = _abs(detail["cover"]["large"] or detail["cover"]["url"])
        if post.type == "event" and post.event_date:
            meta.jsonld.append(_event_ld(detail["title"], post.event_date, meta.description, _url(path, lang),
                                         meta.image, _address(get_effective(db), {})))
        else:
            meta.jsonld.append({
                "@context": "https://schema.org", "@type": "NewsArticle", "headline": detail["title"],
                "datePublished": detail["published_at"], "image": [meta.image] if meta.image else [],
                "publisher": {"@type": "Organization", "name": "Smart Start"},
                "mainEntityOfPage": _url(path, lang),
            })
        return meta

    key = ROUTE_PAGES.get(path, "__none__")
    if key and key != "__none__":
        page = db.scalar(select(Page).where(Page.key == key))
        if page is not None:
            seo = content_svc.page_seo(db, page, lang)
            if seo["title"]:
                meta.title = seo["title"] if key == "home" else f"{seo['title']} — {d['site']}"
            if seo["description"]:
                meta.description = seo["description"]
            if seo["og_image"]:
                meta.image = _abs(seo["og_image"]["large"] or seo["og_image"]["url"])
    elif path in d:
        t, desc = d[path]
        meta.title = f"{t} — {d['site']}"
        meta.description = desc

    if path == "/":
        meta.jsonld.append(_school_ld(db, lang))
        meta.jsonld.extend(_upcoming_events_ld(db, lang))
    if path.startswith("/admin") or path == "/rahmat":
        meta.noindex = True
    if meta.image is None:
        home = db.scalar(select(Page).where(Page.key == "home"))
        if home is not None and home.og_image_id:
            img = public_media(db, home.og_image_id, lang)
            meta.image = _abs(img["large"]) if img else None
    return meta


def _jsonld_tag(obj: dict) -> str:
    data = json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")
    return f'<script type="application/ld+json">{data}</script>'


def head_tags(meta: Meta) -> str:
    e = html.escape
    url = _url(meta.path, meta.lang)
    tags = [
        f'<meta name="description" content="{e(meta.description)}">',
        *(['<meta name="robots" content="noindex, nofollow">'] if meta.noindex else []),
        f'<link rel="canonical" href="{e(url)}">',
        f'<meta property="og:type" content="{meta.og_type}">',
        '<meta property="og:site_name" content="Smart Start">',
        f'<meta property="og:title" content="{e(meta.title)}">',
        f'<meta property="og:description" content="{e(meta.description)}">',
        f'<meta property="og:url" content="{e(url)}">',
        f'<meta property="og:locale" content="{OG_LOCALE[meta.lang]}">',
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{e(meta.title)}">',
        f'<meta name="twitter:description" content="{e(meta.description)}">',
    ]
    if meta.image:
        tags.append(f'<meta property="og:image" content="{e(meta.image)}">')
        tags.append(f'<meta name="twitter:image" content="{e(meta.image)}">')
    for lang in LANGS:
        tags.append(f'<link rel="alternate" hreflang="{lang}" href="{e(_url(meta.path, lang))}">')
    tags.append(f'<link rel="alternate" hreflang="x-default" href="{e(_url(meta.path, "uz"))}">')
    tags.extend(_jsonld_tag(o) for o in meta.jsonld)
    return "\n    ".join(tags)


_STRIP = [
    re.compile(r'<meta\s+name="description"[^>]*>\s*', re.I),
    re.compile(r'<meta\s+property="og:[^"]*"[^>]*>\s*', re.I),
    re.compile(r'<meta\s+name="twitter:[^"]*"[^>]*>\s*', re.I),
    re.compile(r'<link\s+rel="canonical"[^>]*>\s*', re.I),
    re.compile(r'<meta\s+name="robots"[^>]*>\s*', re.I),
    re.compile(r'<link\s+rel="alternate"\s+hreflang[^>]*>\s*', re.I),
]


def inject(index_html: str, meta: Meta) -> str:
    out = index_html
    for rx in _STRIP:
        out = rx.sub("", out)
    title_tag = f"<title>{html.escape(meta.title)}</title>"
    if re.search(r"<title>.*?</title>", out, re.S | re.I):
        out = re.sub(r"<title>.*?</title>", lambda _: title_tag, out, count=1, flags=re.S | re.I)
    else:
        out = out.replace("</head>", f"    {title_tag}\n  </head>", 1)
    m = re.search(r"<html\b[^>]*>", out, re.I)
    if m:
        tag = m.group(0)
        if re.search(r'\slang="[^"]*"', tag):
            new_tag = re.sub(r'\slang="[^"]*"', f' lang="{meta.lang}"', tag, count=1)
        else:
            new_tag = tag[:-1] + f' lang="{meta.lang}">'
        out = out.replace(tag, new_tag, 1)
    return out.replace("</head>", f"  {head_tags(meta)}\n  </head>", 1)


def placeholder_page(meta: Meta) -> str:
    e = html.escape
    return f"""<!doctype html>
<html lang="{meta.lang}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{e(meta.title)}</title>
    {head_tags(meta)}
    <style>
      body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0B1A33;color:#fff;
           display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}}
      main{{max-width:560px;text-align:center}}
      h1{{color:#CF9E2E;margin:0 0 12px}}
      a{{color:#CF9E2E}} p{{line-height:1.6;color:#cbd5e1}}
      code{{background:#13294B;padding:2px 6px;border-radius:4px}}
    </style>
  </head>
  <body>
    <main>
      <h1>Smart Start</h1>
      <p>Backend ishlayapti. Sayt (frontend) hali yig'ilmagan.</p>
      <p>Yig'ish uchun: <code>cd frontend &amp;&amp; npm install &amp;&amp; npm run build</code></p>
      <p><a href="/api/docs">API hujjati (Swagger) → /api/docs</a></p>
    </main>
  </body>
</html>"""


def sitemap_xml(db: Session) -> str:
    s = get_settings()
    today = datetime.now(timezone.utc).date().isoformat()
    entries: list[tuple[str, str, str]] = [(p, today, "1.0" if p == "/" else "0.8") for p in SITEMAP_ROUTES]
    now = utcnow()
    for p in db.scalars(select(Post).where(Post.published_at.is_not(None), Post.published_at <= now)
                        .order_by(Post.published_at.desc())).all():
        lm = (p.updated_at or p.published_at).date().isoformat()
        entries.append((f"/yangiliklar/{p.slug}", lm, "0.6"))
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
             'xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for path, lastmod, prio in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{xml_escape(s.site_url + path)}</loc>")
        for lang in LANGS:
            lines.append(f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{xml_escape(_url(path, lang))}"/>')
        lines.append(f"    <lastmod>{lastmod}</lastmod>")
        lines.append(f"    <priority>{prio}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines)


def robots_txt() -> str:
    s = get_settings()
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /api/\n"
        "Disallow: /admin\n"
        f"\nSitemap: {s.site_url}/sitemap.xml\n"
    )


def static_file(path: str) -> Path | None:
    """A real file inside the built frontend (favicon, logo, manifest...)."""
    if not path or path.endswith("/") or path == "index.html":
        return None
    root = STATIC_DIR.resolve()
    p = (root / path).resolve()
    if root in p.parents and p.is_file():
        return p
    return None
