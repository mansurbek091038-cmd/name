"""Serialisers and business rules for content resources."""
from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import utcnow
from app.core.errors import AppError
from app.core.utils import (
    date_iso,
    excerpt_from,
    merge_fallback,
    pick,
    sanitize_blocks,
    sanitize_html,
    slugify,
    to_local_iso,
)
from app.modules.content.models import (
    Certificate,
    Faq,
    Page,
    Partner,
    Post,
    Price,
    Teacher,
    Testimonial,
)
from app.modules.media.models import Media
from app.modules.media.pipeline import delete_media_files, derive_public_copy
from app.modules.media.schemas import admin_media, media_map, public_media

PAGE_KEYS = ("home", "about", "admission", "contact", "privacy", "thanks", "results", "partners")
MEDIA_KEYS = {"image", "og_image", "cover", "photo", "logo", "background"}
MEDIA_LIST_KEYS = {"images", "gallery"}


def check_media(db: Session, media_id: int | None, *, field: str, private_ok: bool = False,
                must_be_private: bool = False) -> None:
    if not media_id:
        return
    m = db.get(Media, media_id)
    if m is None:
        raise AppError(422, "VALIDATION_ERROR", "Fayl topilmadi", extra={"fields": {field: "Fayl topilmadi"}})
    if must_be_private and not m.is_private:
        raise AppError(422, "VALIDATION_ERROR", "Bu fayl yopiq (private) bo'lishi kerak",
                       extra={"fields": {field: "Yopiq fayl sifatida yuklang (private=true)"}})
    if m.is_private and not private_ok:
        raise AppError(422, "VALIDATION_ERROR", "Yopiq fayl saytda ko'rsatilmaydi",
                       extra={"fields": {field: "Ochiq rasm tanlang"}})


# ---------------- pages ----------------
def _collect_media_ids(value: Any, key: str | None = None, acc: set | None = None) -> set[int]:
    acc = acc if acc is not None else set()
    if isinstance(value, dict):
        for k, v in value.items():
            _collect_media_ids(v, k, acc)
    elif isinstance(value, list):
        if key in MEDIA_LIST_KEYS:
            acc.update(v for v in value if isinstance(v, int))
        else:
            for v in value:
                _collect_media_ids(v, key, acc)
    elif isinstance(value, int) and not isinstance(value, bool) and key in MEDIA_KEYS:
        acc.add(value)
    return acc


def _expand_media(value: Any, mm: dict[int, dict], key: str | None = None) -> Any:
    if isinstance(value, dict):
        return {k: _expand_media(v, mm, k) for k, v in value.items()}
    if isinstance(value, list):
        if key in MEDIA_LIST_KEYS:
            return [mm[v] for v in value if isinstance(v, int) and v in mm]
        return [_expand_media(v, mm, key) for v in value]
    if isinstance(value, int) and not isinstance(value, bool) and key in MEDIA_KEYS:
        return mm.get(value)
    return value


def localized_blocks(db: Session, page: Page, lang: str) -> dict:
    blocks = page.blocks_uz or {}
    if lang != "uz":
        blocks = merge_fallback(blocks, getattr(page, f"blocks_{lang}") or {})
    mm = media_map(db, _collect_media_ids(blocks), lang)
    return _expand_media(blocks, mm)


def page_seo(db: Session, page: Page, lang: str) -> dict:
    return {
        "title": pick(page, "seo_title", lang) or "",
        "description": pick(page, "seo_description", lang) or "",
        "og_image": public_media(db, page.og_image_id, lang),
    }


def page_public(db: Session, page: Page, lang: str) -> dict:
    return {"key": page.key, "blocks": localized_blocks(db, page, lang), "seo": page_seo(db, page, lang)}


def page_admin(db: Session, page: Page) -> dict:
    ids = set()
    for lang in ("uz", "ru", "en"):
        ids |= _collect_media_ids(getattr(page, f"blocks_{lang}") or {})
    if page.og_image_id:
        ids.add(page.og_image_id)
    return {
        "id": page.id, "key": page.key,
        "blocks_uz": page.blocks_uz or {}, "blocks_ru": page.blocks_ru or {}, "blocks_en": page.blocks_en or {},
        "seo_title_uz": page.seo_title_uz, "seo_title_ru": page.seo_title_ru, "seo_title_en": page.seo_title_en,
        "seo_description_uz": page.seo_description_uz, "seo_description_ru": page.seo_description_ru,
        "seo_description_en": page.seo_description_en,
        "og_image_id": page.og_image_id, "og_image": admin_media(db, page.og_image_id),
        "media": {str(k): v for k, v in media_map(db, ids, admin=True).items()},
        "updated_at": to_local_iso(page.updated_at),
    }


def apply_page_update(db: Session, page: Page, data: dict) -> None:
    for lang in ("uz", "ru", "en"):
        k = f"blocks_{lang}"
        if data.get(k) is not None:
            setattr(page, k, sanitize_blocks(data[k]))
    for k, v in data.items():
        if k.startswith("seo_") and v is not None:
            setattr(page, k, v)
    if "og_image_id" in data:
        check_media(db, data["og_image_id"], field="og_image_id")
        page.og_image_id = data["og_image_id"]


# ---------------- posts ----------------
def is_published(p: Post) -> bool:
    return p.published_at is not None and p.published_at <= utcnow()


def post_card(db: Session, p: Post, lang: str) -> dict:
    excerpt = pick(p, "excerpt", lang) or excerpt_from(pick(p, "body", lang))
    return {
        "id": p.id, "type": p.type, "slug": p.slug,
        "title": pick(p, "title", lang), "excerpt": excerpt,
        "cover": public_media(db, p.cover_id, lang),
        "event_date": to_local_iso(p.event_date),
        "published_at": to_local_iso(p.published_at),
    }


def post_detail(db: Session, p: Post, lang: str) -> dict:
    out = post_card(db, p, lang)
    out["body"] = pick(p, "body", lang) or ""
    out["event_location"] = p.event_location
    out["seo"] = {"title": out["title"], "description": out["excerpt"], "og_image": out["cover"]}
    return out


def post_admin(db: Session, p: Post) -> dict:
    status = "draft"
    if p.published_at is not None:
        status = "published" if is_published(p) else "scheduled"
    return {
        "id": p.id, "type": p.type, "slug": p.slug,
        **{f"{f}_{lang}": getattr(p, f"{f}_{lang}") for f in ("title", "excerpt", "body")
           for lang in ("uz", "ru", "en")},
        "cover_id": p.cover_id, "cover": admin_media(db, p.cover_id),
        "event_date": to_local_iso(p.event_date), "event_location": p.event_location,
        "published_at": to_local_iso(p.published_at), "status": status,
        "created_at": to_local_iso(p.created_at), "updated_at": to_local_iso(p.updated_at),
    }


def unique_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    base = slugify(base)
    slug, n = base, 2
    while True:
        q = select(Post.id).where(Post.slug == slug)
        if exclude_id:
            q = q.where(Post.id != exclude_id)
        if db.scalar(q) is None:
            return slug
        slug = f"{base}-{n}"
        n += 1


def post_prepare(db: Session, data: dict, obj: Post | None, user) -> dict:
    for lang in ("uz", "ru", "en"):
        if f"body_{lang}" in data and data[f"body_{lang}"] is not None:
            data[f"body_{lang}"] = sanitize_html(data[f"body_{lang}"])
    if "cover_id" in data:
        check_media(db, data["cover_id"], field="cover_id")
    if obj is None or "slug" in data:
        raw = (data.get("slug") or "").strip() or data.get("title_uz") or (obj.title_uz if obj else "")
        data["slug"] = unique_slug(db, raw, obj.id if obj else None)
    data = {k: v for k, v in data.items() if not (v is None and k in ("type", "title_uz", "slug"))}
    return data


# ---------------- teachers / prices / faq / testimonials / partners ----------------
def teacher_public(db: Session, t: Teacher, lang: str) -> dict:
    return {"id": t.id, "full_name": t.full_name, "subject": pick(t, "subject", lang) or "",
            "experience_years": t.experience_years, "bio": pick(t, "bio", lang) or "",
            "photo": public_media(db, t.photo_id, lang), "badge": pick(t, "badge", lang) or ""}


def teacher_admin(db: Session, t: Teacher) -> dict:
    return {"id": t.id, "full_name": t.full_name, "subject": t.subject_uz,
            **{f"{f}_{lang}": getattr(t, f"{f}_{lang}") for f in ("subject", "bio", "badge")
               for lang in ("uz", "ru", "en")},
            "badge": t.badge_uz, "experience_years": t.experience_years,
            "photo_id": t.photo_id, "photo": admin_media(db, t.photo_id),
            "order": t.order, "is_visible": t.is_visible}


def media_prepare(*fields: str):
    def _prep(db: Session, data: dict, obj, user) -> dict:
        for f in fields:
            if f in data:
                check_media(db, data[f], field=f)
        return {k: v for k, v in data.items() if not (v is None and k in ("full_name", "name", "author",
                                                                        "grade_range", "question_uz",
                                                                        "text_uz", "order", "is_visible"))}
    return _prep


def price_public(p: Price, lang: str) -> dict:
    return {"id": p.id, "grade_range": p.grade_range, "monthly_fee": p.monthly_fee,
            "meals_fee": p.meals_fee, "transport_fee": p.transport_fee, "note": pick(p, "note", lang) or ""}


def price_admin(db: Session, p: Price) -> dict:
    return {"id": p.id, "grade_range": p.grade_range, "monthly_fee": p.monthly_fee,
            "meals_fee": p.meals_fee, "transport_fee": p.transport_fee,
            "note_uz": p.note_uz, "note_ru": p.note_ru, "note_en": p.note_en, "order": p.order}


def faq_public(f: Faq, lang: str) -> dict:
    return {"id": f.id, "question": pick(f, "question", lang), "answer": pick(f, "answer", lang) or ""}


def faq_admin(db: Session, f: Faq) -> dict:
    return {"id": f.id, **{f"{k}_{lang}": getattr(f, f"{k}_{lang}") for k in ("question", "answer")
                          for lang in ("uz", "ru", "en")},
            "order": f.order, "is_visible": f.is_visible}


def testimonial_public(t: Testimonial, lang: str) -> dict:
    return {"id": t.id, "author": t.author, "child_grade": t.child_grade, "text": pick(t, "text", lang)}


def testimonial_admin(db: Session, t: Testimonial) -> dict:
    return {"id": t.id, "author": t.author, "child_grade": t.child_grade,
            "text_uz": t.text_uz, "text_ru": t.text_ru, "text_en": t.text_en,
            "order": t.order, "is_visible": t.is_visible}


def partner_public(db: Session, p: Partner, lang: str) -> dict:
    return {"id": p.id, "name": p.name, "country": pick(p, "country", lang) or "",
            "country_code": p.country_code, "logo": public_media(db, p.logo_id, lang),
            "qs_rank": p.qs_rank, "qs_year": p.qs_year, "description": pick(p, "description", lang) or "",
            "website_url": p.website_url, "lat": p.lat, "lng": p.lng}


def partner_admin(db: Session, p: Partner) -> dict:
    return {"id": p.id, "name": p.name, "country": p.country_uz,
            **{f"{f}_{lang}": getattr(p, f"{f}_{lang}") for f in ("country", "description")
               for lang in ("uz", "ru", "en")},
            "country_code": p.country_code, "logo_id": p.logo_id, "logo": admin_media(db, p.logo_id),
            "qs_rank": p.qs_rank, "qs_year": p.qs_year, "website_url": p.website_url,
            "lat": p.lat, "lng": p.lng, "order": p.order, "is_visible": p.is_visible}


# ---------------- certificates ----------------
CEFR_VALUES = {"A1": 30, "A2": 45, "B1": 60, "B2": 75, "C1": 90, "C2": 100}
OLYMPIAD_LEVEL_BONUS = {"xalqaro": 12, "respublika": 10, "viloyat": 6, "shahar": 3, "tuman": 0}


def _num(s: str) -> float | None:
    m = re.search(r"\d+(?:[.,]\d+)?", s or "")
    return float(m.group(0).replace(",", ".")) if m else None


def score_value(ctype: str, score: str, level: str = "") -> float:
    """Normalise very different scales to 0..100 so 'top' sorting works across types."""
    n = _num(score)
    if ctype == "IELTS" and n is not None:
        return round(n / 9 * 100, 2)
    if ctype == "SAT" and n is not None:
        return round(n / 1600 * 100, 2)
    if ctype == "CEFR":
        return float(CEFR_VALUES.get((score or "").strip().upper()[:2], 0))
    if ctype == "olimpiada" and n is not None:
        base = {1: 88, 2: 80, 3: 72}.get(int(n), 60)
        return float(base + OLYMPIAD_LEVEL_BONUS.get((level or "").lower(), 0))
    return 50.0


def mask_cert_number(n: str | None) -> str:
    n = (n or "").strip()
    if not n:
        return ""
    if len(n) <= 4:
        return "•" * len(n)
    keep_start = 3 if len(n) > 8 else 1
    return n[:keep_start] + "•" * (len(n) - keep_start - 2) + n[-2:]


def certificate_public(db: Session, c: Certificate, lang: str = "uz", mm: dict | None = None) -> dict:
    image = (mm or {}).get(c.image_id) if mm is not None else public_media(db, c.image_id, lang)
    subs = c.sub_scores or {}
    return {
        "id": c.id, "type": c.type, "score": c.score,
        "sub_scores": {k: subs.get(k) for k in ("listening", "reading", "writing", "speaking", "math", "ebrw")},
        "student_name": c.student_name, "grade": c.grade, "year": c.year, "date": date_iso(c.date),
        "subject": c.subject, "level": c.level, "teacher": c.teacher,
        "cert_number_masked": mask_cert_number(c.cert_number),
        "image": image, "verify_url": c.verify_url or None,
        "is_featured": c.is_featured, "is_new": c.is_new,
    }


def certificate_admin(db: Session, c: Certificate) -> dict:
    out = certificate_public(db, c)
    image = admin_media(db, c.image_id)
    if image and not c.parent_consent and not image["is_private"]:
        endpoint = f"/api/v1/admin/media/{c.image_id}/file"
        for field, size in (("url", "full"), ("thumb", "thumb"), ("medium", "medium"), ("large", "large")):
            image[field] = f"{endpoint}?size={size}"
    out.update({
        "image": image,
        "image_id": c.image_id,
        "original_image_id": c.original_image_id,
        "original_image": admin_media(db, c.original_image_id),
        "redact_regions": c.redact_regions or [],
        "cert_number": c.cert_number,
        "sub_scores": c.sub_scores or {},
        "parent_consent": c.parent_consent,
        "consent_file_id": c.consent_file_id,
        "consent_file": admin_media(db, c.consent_file_id),
        "order": c.order,
        "score_value": c.score_value,
        "created_at": to_local_iso(c.created_at),
        "updated_at": to_local_iso(c.updated_at),
    })
    return out


def certificate_prepare(db: Session, data: dict, obj: Certificate | None, user) -> dict:
    if "image_id" in data:
        check_media(db, data["image_id"], field="image_id", private_ok=True)
    if "consent_file_id" in data:
        check_media(db, data["consent_file_id"], field="consent_file_id", private_ok=True, must_be_private=True)
    if "redact_regions" in data and data["redact_regions"] is not None:
        data["redact_regions"] = [dict(r) for r in data["redact_regions"]]
    for k in ("type", "score", "student_name", "sub_scores", "redact_regions", "order",
              "parent_consent", "is_featured", "is_new"):
        if k in data and data[k] is None:
            data.pop(k)
    if obj is not None:
        data["_prev_image_id"] = obj.image_id
        data["_prev_original_id"] = obj.original_image_id
        data["_prev_regions"] = list(obj.redact_regions or [])
    ctype = data.get("type", obj.type if obj else "boshqa")
    score = data.get("score", obj.score if obj else "")
    level = data.get("level", obj.level if obj else "")
    data["score_value"] = score_value(ctype, score, level)
    if data.get("date") and not data.get("year") and not (obj and obj.year):
        data["year"] = data["date"].year
    return data


def _delete_media(db: Session, media_id: int | None) -> None:
    if not media_id:
        return
    old = db.get(Media, media_id)
    if old is not None:
        db.delete(old)
        db.flush()
        delete_media_files(old)


def certificate_after_save(db: Session, c: Certificate, data: dict, user) -> None:
    """Originals stay private; the site only ever gets a compressed (optionally redacted) copy."""
    prev_public = data.get("_prev_image_id")
    prev_original = data.get("_prev_original_id")
    prev_regions = data.get("_prev_regions") or []
    regenerate = False
    if "image_id" in data:
        new_src = data["image_id"]
        if new_src is None:
            c.original_image_id = None
            c.image_id = None
        elif new_src != prev_public:  # a newly chosen image
            src = db.get(Media, new_src)
            c.original_image_id = src.id
            if src.is_private or c.redact_regions:
                regenerate = True
            else:
                c.image_id = src.id
        else:  # the form echoed back the current public copy
            c.image_id = prev_public
    if ("redact_regions" in data and c.original_image_id and not regenerate
            and (data["redact_regions"] or []) != prev_regions):
        regenerate = True
    if regenerate and c.original_image_id:
        src = db.get(Media, c.original_image_id)
        new = derive_public_copy(db, src, redact=c.redact_regions or None,
                                 alt_uz=f"{c.type} {c.score} — {c.student_name}")
        c.image_id = new.id
    db.flush()
    if prev_public and prev_public not in (c.image_id, c.original_image_id, prev_original):
        _delete_media(db, prev_public)  # old derived copy is no longer used


def certificate_before_delete(db: Session, c: Certificate, user) -> None:
    if c.image_id and c.image_id != c.original_image_id:
        image_id = c.image_id
        c.image_id = None
        db.flush()
        _delete_media(db, image_id)


def compute_stats(certs: list[Certificate]) -> dict:
    ielts = cefr = olymp = sat = 0
    for c in certs:
        n = _num(c.score)
        if c.type == "IELTS" and n is not None and n >= 7:
            ielts += 1
        elif c.type == "CEFR" and (c.score or "").strip().upper()[:2] in ("B2", "C1", "C2"):
            cefr += 1
        elif c.type == "olimpiada" and n is not None and 1 <= n <= 3:
            olymp += 1
        elif c.type == "SAT" and n is not None and n >= 1300:
            sat += 1
    return {"ielts_7_plus": ielts, "cefr_b2_c1": cefr, "olympiad_winners": olymp,
            "sat_1300_plus": sat, "total": len(certs)}

