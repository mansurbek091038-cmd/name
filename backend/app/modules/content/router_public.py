"""Public (no auth) content endpoints."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.db import get_db, utcnow
from app.core.errors import AppError
from app.core.utils import lang_or_default, page_dict, paginate
from app.modules.content import service as svc
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
from app.modules.content.schemas import normalize_cert_type
from app.modules.media.schemas import media_map

router = APIRouter(prefix="/public", tags=["public: content"])

LangQ = Query("uz", pattern="^(uz|ru|en)$", description="uz | ru | en")


@router.get("/pages/{key}", summary="Sahifa bloklari")
def get_page(key: str, lang: str = LangQ, db: Session = Depends(get_db)):
    page = db.scalar(select(Page).where(Page.key == key))
    if page is None:
        raise AppError(404, "NOT_FOUND", "Sahifa topilmadi")
    return svc.page_public(db, page, lang_or_default(lang))


@router.get("/posts", summary="Yangiliklar va tadbirlar")
def list_posts(type: Literal["news", "event"] | None = None, lang: str = LangQ,
               upcoming: bool | None = Query(None, description="Faqat kelgusi tadbirlar (type=event)"),
               page: int = Query(1, ge=1), page_size: int = Query(12, ge=1, le=50),
               db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    now = utcnow()
    stmt = select(Post).where(Post.published_at.is_not(None), Post.published_at <= now)
    if type:
        stmt = stmt.where(Post.type == type)
    if upcoming:
        stmt = stmt.where(Post.event_date.is_not(None), Post.event_date >= now).order_by(Post.event_date.asc())
    else:
        stmt = stmt.order_by(Post.published_at.desc(), Post.id.desc())
    return paginate(db, stmt, page, page_size, lambda p: svc.post_card(db, p, lang))


@router.get("/posts/{slug}", summary="Bitta maqola")
def get_post(slug: str, lang: str = LangQ, db: Session = Depends(get_db)):
    p = db.scalar(select(Post).where(Post.slug == slug))
    if p is None or not svc.is_published(p):
        raise AppError(404, "NOT_FOUND", "Maqola topilmadi")
    return svc.post_detail(db, p, lang_or_default(lang))


@router.get("/teachers", summary="O'qituvchilar")
def teachers(lang: str = LangQ, db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    rows = db.scalars(select(Teacher).where(Teacher.is_visible.is_(True)).order_by(Teacher.order, Teacher.id)).all()
    return [svc.teacher_public(db, t, lang) for t in rows]


@router.get("/prices", summary="Narxlar (so'm)")
def prices(lang: str = LangQ, db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    return [svc.price_public(p, lang) for p in db.scalars(select(Price).order_by(Price.order, Price.id)).all()]


@router.get("/faqs", summary="Ko'p beriladigan savollar")
def faqs(lang: str = LangQ, db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    rows = db.scalars(select(Faq).where(Faq.is_visible.is_(True)).order_by(Faq.order, Faq.id)).all()
    return [svc.faq_public(f, lang) for f in rows]


@router.get("/testimonials", summary="Ota-onalar fikrlari")
def testimonials(lang: str = LangQ, db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    rows = db.scalars(select(Testimonial).where(Testimonial.is_visible.is_(True))
                      .order_by(Testimonial.order, Testimonial.id)).all()
    return [svc.testimonial_public(t, lang) for t in rows]


@router.get("/partners", summary="Hamkor universitetlar")
def partners(lang: str = LangQ, db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    rows = db.scalars(select(Partner).where(Partner.is_visible.is_(True)).order_by(Partner.order, Partner.id)).all()
    return [svc.partner_public(db, p, lang) for p in rows]


# ---------------- certificates ----------------
def _cert_base():
    # Only certificates with written parent consent are ever public.
    return select(Certificate).where(Certificate.parent_consent.is_(True))


@router.get("/certificates/stats", summary="Natijalar statistikasi")
def certificate_stats(db: Session = Depends(get_db)):
    return svc.compute_stats(list(db.scalars(_cert_base()).all()))


@router.get("/certificates", summary="Sertifikatlar (faqat ota-ona roziligi borlari)")
def certificates(
    type: str | None = Query(None, description="IELTS | CEFR | SAT | olimpiada | boshqa"),
    year: int | None = None,
    grade: int | None = None,
    search: str | None = Query(None, max_length=100),
    featured: bool | None = None,
    sort: Literal["new", "top", "name"] = "new",
    lang: str = LangQ,
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    db: Session = Depends(get_db),
):
    stmt = _cert_base()
    if type:
        t = normalize_cert_type(type)
        stmt = stmt.where(Certificate.type == t)
    if year:
        stmt = stmt.where(Certificate.year == year)
    if grade is not None:
        stmt = stmt.where(Certificate.grade == grade)
    if featured is not None:
        stmt = stmt.where(Certificate.is_featured.is_(featured))
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Certificate.student_name.ilike(like), Certificate.subject.ilike(like)))
    if sort == "top":
        stmt = stmt.order_by(Certificate.score_value.desc(), Certificate.id.desc())
    elif sort == "name":
        stmt = stmt.order_by(Certificate.student_name.asc(), Certificate.id)
    else:
        stmt = stmt.order_by(Certificate.year.desc().nulls_last(), Certificate.date.desc().nulls_last(),
                             Certificate.order, Certificate.id.desc())
    lang = lang_or_default(lang)
    result = paginate(db, stmt, page, page_size, lambda c: c)
    mm = media_map(db, {c.image_id for c in result["items"] if c.image_id}, lang)
    items = [svc.certificate_public(db, c, lang, mm) for c in result["items"]]
    return page_dict(items, result["total"], result["page"], result["page_size"])


@router.get("/certificates/{cert_id}", summary="Bitta sertifikat")
def certificate(cert_id: int, lang: str = LangQ, db: Session = Depends(get_db)):
    c = db.get(Certificate, cert_id)
    if c is None or not c.parent_consent:
        raise AppError(404, "NOT_FOUND", "Sertifikat topilmadi")
    return svc.certificate_public(db, c, lang_or_default(lang))
