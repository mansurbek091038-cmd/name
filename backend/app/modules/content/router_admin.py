"""Admin CRUD for content (manager and above)."""
from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit, diff, snapshot
from app.core.config import get_settings
from app.core.crud import crud_router
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import require_manager
from app.modules.auth.models import User
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
from app.modules.content.schemas import (
    CertificateIn,
    FaqIn,
    PageIn,
    PartnerIn,
    PostIn,
    PriceIn,
    Region,
    TeacherIn,
    TestimonialIn,
    normalize_cert_type,
)
from app.modules.media.pipeline import create_media

posts_router = crud_router(
    prefix="/admin/posts", tag="admin: posts", model=Post, entity="post", create_schema=PostIn,
    to_admin=svc.post_admin, search_fields=("title_uz", "title_ru", "title_en", "slug"),
    default_order=lambda m: [m.published_at.desc().nulls_first(), m.id.desc()],
    filters={"type": ("type", str)}, prepare=svc.post_prepare, has_order=False,
)

teachers_router = crud_router(
    prefix="/admin/teachers", tag="admin: teachers", model=Teacher, entity="teacher",
    create_schema=TeacherIn, to_admin=svc.teacher_admin, search_fields=("full_name", "subject_uz"),
    prepare=svc.media_prepare("photo_id"),
)

prices_router = crud_router(
    prefix="/admin/prices", tag="admin: prices", model=Price, entity="price", create_schema=PriceIn,
    to_admin=svc.price_admin, search_fields=("grade_range", "note_uz"), prepare=svc.media_prepare(),
)

faqs_router = crud_router(
    prefix="/admin/faqs", tag="admin: faqs", model=Faq, entity="faq", create_schema=FaqIn,
    to_admin=svc.faq_admin, search_fields=("question_uz", "question_ru", "question_en", "answer_uz"),
    prepare=svc.media_prepare(),
)

testimonials_router = crud_router(
    prefix="/admin/testimonials", tag="admin: testimonials", model=Testimonial, entity="testimonial",
    create_schema=TestimonialIn, to_admin=svc.testimonial_admin, search_fields=("author", "text_uz"),
    prepare=svc.media_prepare(),
)

partners_router = crud_router(
    prefix="/admin/partners", tag="admin: partners", model=Partner, entity="partner", create_schema=PartnerIn,
    to_admin=svc.partner_admin, search_fields=("name", "country_uz", "country_en"),
    prepare=svc.media_prepare("logo_id"),
)

certificates_router = crud_router(
    prefix="/admin/certificates", tag="admin: certificates", model=Certificate, entity="certificate",
    create_schema=CertificateIn, to_admin=svc.certificate_admin,
    search_fields=("student_name", "cert_number", "teacher", "subject"),
    default_order=lambda m: [m.year.desc().nulls_last(), m.order, m.id.desc()],
    filters={
        "type": ("type", lambda v: normalize_cert_type(v)),
        "year": ("year", int),
        "grade": ("grade", int),
        "parent_consent": ("parent_consent", lambda v: v.lower() in ("1", "true", "yes")),
        "is_featured": ("is_featured", lambda v: v.lower() in ("1", "true", "yes")),
    },
    prepare=svc.certificate_prepare, after_save=svc.certificate_after_save,
    before_delete=svc.certificate_before_delete,
)

extra_router = APIRouter(prefix="/admin", tags=["admin: certificates"])


@extra_router.post("/certificates/{cert_id}/image",
                   summary="Sertifikat rasmini yuklash: asl nusxa yopiq, saytga siqilgan nusxa")
async def upload_certificate_image(
    cert_id: int,
    request: Request,
    file: UploadFile = File(...),
    redact_regions: str | None = Form(None, description='JSON: [{"x":0.1,"y":0.8,"w":0.3,"h":0.05}]'),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    c = db.get(Certificate, cert_id)
    if c is None:
        raise AppError(404, "NOT_FOUND", "Sertifikat topilmadi")
    regions = None
    if redact_regions:
        try:
            regions = [Region(**r).model_dump() for r in json.loads(redact_regions)]
        except (ValueError, TypeError):
            raise AppError(422, "VALIDATION_ERROR", "redact_regions noto'g'ri",
                           extra={"fields": {"redact_regions": "JSON ro'yxat bo'lishi kerak"}}) from None
    data = await file.read(get_settings().max_upload_mb * 1024 * 1024 + 1)
    before = snapshot(c)
    original = create_media(db, data, file.filename or "", private=True, uploaded_by=user.id,
                            alt_uz=f"{c.type} {c.score} — {c.student_name} (asl nusxa)")
    payload = {"image_id": original.id, "_prev_image_id": c.image_id,
               "_prev_original_id": c.original_image_id, "_prev_regions": list(c.redact_regions or [])}
    if regions is not None:
        c.redact_regions = regions
        payload["redact_regions"] = regions
    c.image_id = original.id
    svc.certificate_after_save(db, c, payload, user)
    audit(db, user, "update", "certificate", c.id, {"changes": diff(before, snapshot(c))}, request)
    db.commit()
    return svc.certificate_admin(db, c)


# ---------------- pages ----------------
pages_router = APIRouter(prefix="/admin/pages", tags=["admin: pages"])
KEY_RE = re.compile(r"^[a-z0-9_-]{2,50}$")


@pages_router.get("", summary="Sahifalar ro'yxati")
def list_pages(db: Session = Depends(get_db), _: User = Depends(require_manager)):
    rows = db.scalars(select(Page).order_by(Page.key)).all()
    return [{"id": p.id, "key": p.key, "seo_title_uz": p.seo_title_uz,
             "updated_at": svc.to_local_iso(p.updated_at)} for p in rows]


@pages_router.get("/{key}", summary="Sahifa (barcha tillar)")
def get_page(key: str, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    page = db.scalar(select(Page).where(Page.key == key))
    if page is None:
        raise AppError(404, "NOT_FOUND", "Sahifa topilmadi")
    return svc.page_admin(db, page)


@pages_router.put("/{key}", summary="Sahifani saqlash (yo'q bo'lsa yaratiladi)")
def put_page(key: str, body: PageIn, request: Request, db: Session = Depends(get_db),
             user: User = Depends(require_manager)):
    if not KEY_RE.match(key):
        raise AppError(422, "VALIDATION_ERROR", "Sahifa kaliti noto'g'ri", extra={"fields": {"key": "a-z, 0-9, _ -"}})
    page = db.scalar(select(Page).where(Page.key == key))
    created = page is None
    if created:
        page = Page(key=key, blocks_uz={}, blocks_ru={}, blocks_en={})
        db.add(page)
        db.flush()
    before = snapshot(page)
    svc.apply_page_update(db, page, body.model_dump(exclude_unset=True))
    db.flush()
    audit(db, user, "create" if created else "update", "page", page.id,
          {"key": key, "changes": diff(before, snapshot(page))}, request)
    db.commit()
    return svc.page_admin(db, page)
