from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import audit
from app.core.crud import crud_router
from app.core.db import get_db
from app.core.errors import AppError
from app.core.ratelimit import client_ip, enforce
from app.core.security import require_manager
from app.core.utils import lang_or_default, page_dict, paginate
from app.modules.auth.models import User
from app.modules.courses.models import Course, CourseEnrollment
from app.modules.courses.schemas import CourseEnrollIn, CourseIn
from app.modules.courses.service import (
    course_admin,
    course_prepare,
    course_public,
    enrollment_admin,
)
from app.modules.notifications import service as notify

public_router = APIRouter(prefix="/public/courses", tags=["public: courses"])
admin_enrollments_router = APIRouter(prefix="/admin/course-enrollments", tags=["admin: course enrollments"])


@public_router.get("", summary="Faol kurslar ro'yxati")
def list_courses(lang: str = "uz", db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    courses = db.scalars(
        select(Course).where(Course.is_active.is_(True)).order_by(Course.order, Course.id)
    ).all()
    return [course_public(db, c, lang) for c in courses]


@public_router.get("/{course_id}", summary="Kurs haqida to'liq ma'lumot")
def get_course(course_id: int, lang: str = "uz", db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    c = db.get(Course, course_id)
    if c is None or not c.is_active:
        raise AppError(404, "NOT_FOUND", "Kurs topilmadi")
    return course_public(db, c, lang)


@public_router.post("/{course_id}/enroll", status_code=201, summary="Kursga yozilish")
def enroll_course(
    course_id: int,
    body: CourseEnrollIn,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    enforce(request, "course_enroll", limit=10, window_seconds=3600)
    ip = client_ip(request)

    course = db.get(Course, course_id)
    if course is None or not course.is_active:
        raise AppError(404, "NOT_FOUND", "Kurs topilmadi yoki faol emas")

    notify.verify_turnstile(db, body.turnstile_token, ip)

    enr = CourseEnrollment(
        course_id=course.id,
        course_title=course.title_uz,
        name=body.name.strip(),
        phone=body.phone,
        comment=(body.comment or "").strip(),
        ip=ip,
    )
    db.add(enr)
    db.commit()
    db.refresh(enr)

    background.add_task(notify.notify_course_enrollment, enr.id)

    return {
        "ok": True,
        "enrollment_id": enr.id,
        "message": "Arizangiz muvaffaqiyatli qabul qilindi. Tez orada siz bilan bog'lanamiz!",
    }


admin_courses_router = crud_router(
    prefix="/admin/courses",
    tag="admin: courses",
    model=Course,
    entity="course",
    create_schema=CourseIn,
    to_admin=course_admin,
    prepare=course_prepare,
    search_fields=("title_uz", "description_uz"),
)


@admin_enrollments_router.get("", summary="Kursga yozilganlar ro'yxati")
def list_enrollments(
    course_id: int | None = Query(None),
    search: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_manager),
):
    stmt = select(CourseEnrollment).order_by(CourseEnrollment.id.desc())
    if course_id:
        stmt = stmt.where(CourseEnrollment.course_id == course_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where((CourseEnrollment.name.ilike(like)) | (CourseEnrollment.phone.ilike(like)))
    return paginate(db, stmt, page, page_size, lambda x: enrollment_admin(db, x))


@admin_enrollments_router.patch("/{enr_id}/handle", summary="Holatini o'zgartirish")
def toggle_handled(
    enr_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    enr = db.get(CourseEnrollment, enr_id)
    if enr is None:
        raise AppError(404, "NOT_FOUND", "Ariza topilmadi")
    enr.is_handled = not enr.is_handled
    db.commit()
    audit(db, user, "update", "course_enrollment", enr.id, {"is_handled": enr.is_handled}, request)
    return {"id": enr.id, "is_handled": enr.is_handled}


@admin_enrollments_router.delete("/{enr_id}", status_code=204, summary="Arizani o'chirish")
def delete_enrollment(
    enr_id: int,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    enr = db.get(CourseEnrollment, enr_id)
    if enr is None:
        raise AppError(404, "NOT_FOUND", "Ariza topilmadi")
    db.delete(enr)
    db.commit()
    audit(db, user, "delete", "course_enrollment", enr_id, {"name": enr.name, "phone": enr.phone}, request)
    return Response(status_code=204)
