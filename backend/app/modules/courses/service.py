from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.utils import pick, to_local_iso
from app.modules.courses.models import Course, CourseEnrollment
from app.modules.media.models import Media
from app.modules.media.schemas import admin_media, public_media


def check_media(db: Session, media_id: int | None, *, field: str) -> None:
    if not media_id:
        return
    m = db.get(Media, media_id)
    if m is None:
        raise AppError(422, "VALIDATION_ERROR", "Fayl topilmadi", extra={"fields": {field: "Fayl topilmadi"}})
    if m.is_private:
        raise AppError(422, "VALIDATION_ERROR", "Yopiq fayl saytda ko'rsatilmaydi", extra={"fields": {field: "Ochiq rasm tanlang"}})


def course_public(db: Session, c: Course, lang: str = "uz") -> dict:
    return {
        "id": c.id,
        "title": pick(c, "title", lang) or c.title_uz,
        "description": pick(c, "description", lang) or c.description_uz,
        "image": public_media(db, c.image_id, lang) if c.image_id else None,
        "duration": c.duration,
        "price": c.price,
        "price_text": c.price_text,
        "order": c.order,
        "is_active": c.is_active,
    }


def course_admin(db: Session, c: Course) -> dict:
    return {
        "id": c.id,
        "title": c.title_uz,
        "title_uz": c.title_uz,
        "title_ru": c.title_ru,
        "title_en": c.title_en,
        "description": c.description_uz,
        "description_uz": c.description_uz,
        "description_ru": c.description_ru,
        "description_en": c.description_en,
        "image_id": c.image_id,
        "image": admin_media(db, c.image_id) if c.image_id else None,
        "duration": c.duration,
        "price": c.price,
        "price_text": c.price_text,
        "order": c.order,
        "is_active": c.is_active,
        "created_at": to_local_iso(c.created_at),
        "updated_at": to_local_iso(c.updated_at),
    }


def course_prepare(db: Session, data: dict, obj: Course | None, user) -> dict:
    if "image_id" in data:
        check_media(db, data["image_id"], field="image_id")
    return data


def enrollment_admin(db: Session, enr: CourseEnrollment) -> dict:
    return {
        "id": enr.id,
        "course_id": enr.course_id,
        "course_title": enr.course_title or (enr.course.title_uz if enr.course else "—"),
        "name": enr.name,
        "phone": enr.phone,
        "comment": enr.comment,
        "is_handled": enr.is_handled,
        "ip": enr.ip,
        "created_at": to_local_iso(enr.created_at),
    }
