"""Excursions / open days: public booking with capacity control, admin management."""
from __future__ import annotations

import datetime as dt
import threading
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import audit, diff, snapshot
from app.core.crud import crud_router
from app.core.db import get_db
from app.core.errors import AppError
from app.core.ratelimit import client_ip, enforce
from app.core.security import require_manager
from app.core.utils import (
    normalize_uz_phone,
    now_local,
    page_dict,
    to_local_iso,
    today_local,
)
from app.modules.auth.models import User
from app.modules.events.models import Tour, TourBooking
from app.modules.notifications import service as notify

public_router = APIRouter(prefix="/public", tags=["public: tours"])
admin_router = APIRouter(prefix="/admin", tags=["admin: tours"])

# Serialises capacity checks inside this process (SQLite); PostgreSQL also gets a row lock.
_booking_lock = threading.Lock()


class _In(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class TourIn(_In):
    date: dt.date
    time: dt.time
    capacity: int = Field(10, ge=1, le=1000)
    type: Literal["ekskursiya", "ochiq_eshiklar"] = "ekskursiya"
    note: str = Field("", max_length=300)
    is_active: bool = True


class BookingIn(_In):
    parent_name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., max_length=30)
    children_count: int = Field(1, ge=1, le=10)
    comment: str | None = Field(None, max_length=500)
    turnstile_token: str | None = Field(None, max_length=4096)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_uz_phone(v)


def booked_count(db: Session, tour_id: int) -> int:
    return db.scalar(select(func.count()).select_from(TourBooking).where(TourBooking.tour_id == tour_id)) or 0


def tour_public(t: Tour, booked: int) -> dict:
    return {"id": t.id, "date": t.date.isoformat(), "time": t.time.strftime("%H:%M"), "type": t.type,
            "capacity": t.capacity, "booked": booked, "free": max(0, t.capacity - booked), "note": t.note}


def tour_admin(db: Session, t: Tour) -> dict:
    booked = booked_count(db, t.id)
    children = db.scalar(select(func.coalesce(func.sum(TourBooking.children_count), 0))
                         .where(TourBooking.tour_id == t.id)) or 0
    out = tour_public(t, booked)
    out.update({"is_active": t.is_active, "children_total": int(children),
                "created_at": to_local_iso(t.created_at)})
    return out


def booking_out(b: TourBooking) -> dict:
    return {"id": b.id, "tour_id": b.tour_id, "parent_name": b.parent_name, "phone": b.phone,
            "children_count": b.children_count, "comment": b.comment, "created_at": to_local_iso(b.created_at)}


def _is_open(t: Tour) -> bool:
    if not t.is_active:
        return False
    now = now_local()
    return (t.date, t.time) > (now.date(), now.time().replace(tzinfo=None))


@public_router.get("/tours", summary="Kelgusi ekskursiyalar va bo'sh joylar")
def public_tours(type: Literal["ekskursiya", "ochiq_eshiklar"] | None = None, db: Session = Depends(get_db)):
    stmt = select(Tour).where(Tour.is_active.is_(True), Tour.date >= today_local())
    if type:
        stmt = stmt.where(Tour.type == type)
    tours = [t for t in db.scalars(stmt.order_by(Tour.date, Tour.time)).all() if _is_open(t)]
    counts = dict(db.execute(select(TourBooking.tour_id, func.count()).where(
        TourBooking.tour_id.in_([t.id for t in tours])).group_by(TourBooking.tour_id)).all()) if tours else {}
    return [tour_public(t, counts.get(t.id, 0)) for t in tours]


def _book(db: Session, tour_id: int, body: BookingIn, ip: str) -> TourBooking:
    with _booking_lock:
        t = db.scalar(select(Tour).where(Tour.id == tour_id).with_for_update())
        if t is None:
            raise AppError(404, "NOT_FOUND", "Ekskursiya topilmadi")
        if not _is_open(t):
            raise AppError(409, "TOUR_CLOSED", "Bu ekskursiyaga yozilish yopilgan")
        if db.scalar(select(TourBooking.id).where(TourBooking.tour_id == t.id, TourBooking.phone == body.phone)):
            raise AppError(409, "ALREADY_BOOKED", "Bu telefon raqami bilan allaqachon yozilgansiz")
        if booked_count(db, t.id) >= t.capacity:
            raise AppError(409, "TOUR_FULL", "Afsuski, bu vaqtga joylar qolmadi. Boshqa sanani tanlang")
        b = TourBooking(tour_id=t.id, parent_name=body.parent_name, phone=body.phone,
                        children_count=body.children_count, comment=body.comment or "", ip=ip)
        db.add(b)
        db.commit()
        return b


@public_router.post("/tours/{tour_id}/book", status_code=201, summary="Ekskursiyaga yozilish")
def book_tour(tour_id: int, body: BookingIn, request: Request, background: BackgroundTasks,
              db: Session = Depends(get_db)):
    ip = client_ip(request)
    enforce(request, "tour-book", 10, 3600)
    notify.verify_turnstile(db, body.turnstile_token, ip)
    b = _book(db, tour_id, body, ip)
    background.add_task(notify.notify_tour_booking, b.id)
    t = db.get(Tour, tour_id)
    return {"id": b.id, "tour": tour_public(t, booked_count(db, t.id)),
            "message": "Siz ekskursiyaga yozildingiz! Menejerimiz tasdiqlash uchun qo'ng'iroq qiladi."}


# ---------------- admin: tours ----------------
def _tour_prepare(db: Session, data: dict, obj: Tour | None, user) -> dict:
    data = {k: v for k, v in data.items() if not (v is None and k in ("date", "time", "capacity", "type",
                                                                        "is_active", "note"))}
    if obj is not None and "capacity" in data:
        booked = booked_count(db, obj.id)
        if data["capacity"] < booked:
            raise AppError(409, "CAPACITY_BELOW_BOOKED",
                           f"Joylar soni band qilinganlardan ({booked}) kam bo'lishi mumkin emas")
    return data


def _upcoming_filter(stmt, raw: str):
    if raw.lower() in ("1", "true", "yes"):
        return stmt.where(Tour.date >= today_local())
    return stmt.where(Tour.date < today_local())


tours_router = crud_router(
    prefix="/admin/tours", tag="admin: tours", model=Tour, entity="tour", create_schema=TourIn,
    to_admin=tour_admin, search_fields=("note",),
    default_order=lambda m: [m.date.desc(), m.time.desc()],
    filters={"type": ("type", str), "upcoming": _upcoming_filter}, prepare=_tour_prepare, has_order=False,
)


# ---------------- admin: bookings ----------------
class BookingAdminIn(_In):
    parent_name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., max_length=30)
    children_count: int = Field(1, ge=1, le=10)
    comment: str = Field("", max_length=500)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_uz_phone(v)


class BookingAdminUpdate(_In):
    parent_name: str | None = Field(None, min_length=2, max_length=150)
    phone: str | None = Field(None, max_length=30)
    children_count: int | None = Field(None, ge=1, le=10)
    comment: str | None = Field(None, max_length=500)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str | None) -> str | None:
        return normalize_uz_phone(v) if v else v


def _tour(db: Session, tour_id: int) -> Tour:
    t = db.get(Tour, tour_id)
    if t is None:
        raise AppError(404, "NOT_FOUND", "Ekskursiya topilmadi")
    return t


def _booking(db: Session, tour_id: int, booking_id: int) -> TourBooking:
    b = db.get(TourBooking, booking_id)
    if b is None or b.tour_id != tour_id:
        raise AppError(404, "NOT_FOUND", "Yozilish topilmadi")
    return b


@admin_router.get("/tours/{tour_id}/bookings", summary="Ekskursiyaga yozilganlar")
def list_bookings(tour_id: int, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
                  search: str | None = Query(None, max_length=100),
                  db: Session = Depends(get_db), _: User = Depends(require_manager)):
    _tour(db, tour_id)
    stmt = select(TourBooking).where(TourBooking.tour_id == tour_id)
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(TourBooking.parent_name.ilike(like), TourBooking.phone.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(TourBooking.created_at).offset((page - 1) * page_size).limit(page_size)).all()
    return page_dict([booking_out(b) for b in rows], total, page, page_size)


@admin_router.post("/tours/{tour_id}/bookings", status_code=201, summary="Qo'lda yozib qo'yish")
def admin_add_booking(tour_id: int, body: BookingAdminIn, request: Request, db: Session = Depends(get_db),
                      user: User = Depends(require_manager)):
    with _booking_lock:
        t = db.scalar(select(Tour).where(Tour.id == tour_id).with_for_update())
        if t is None:
            raise AppError(404, "NOT_FOUND", "Ekskursiya topilmadi")
        if booked_count(db, t.id) >= t.capacity:
            raise AppError(409, "TOUR_FULL", "Joylar qolmagan. Avval joylar sonini oshiring")
        b = TourBooking(tour_id=t.id, **body.model_dump())
        db.add(b)
        db.flush()
        audit(db, user, "create", "tour_booking", b.id, {"tour_id": t.id}, request)
        db.commit()
    return booking_out(b)


@admin_router.get("/tours/{tour_id}/bookings/{booking_id}", summary="Yozilish")
def get_booking(tour_id: int, booking_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return booking_out(_booking(db, tour_id, booking_id))


@admin_router.put("/tours/{tour_id}/bookings/{booking_id}", summary="Yozilishni tahrirlash")
def update_booking(tour_id: int, booking_id: int, body: BookingAdminUpdate, request: Request,
                   db: Session = Depends(get_db), user: User = Depends(require_manager)):
    b = _booking(db, tour_id, booking_id)
    before = snapshot(b)
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(b, k, v)
    db.flush()
    audit(db, user, "update", "tour_booking", b.id, {"changes": diff(before, snapshot(b))}, request)
    db.commit()
    return booking_out(b)


@admin_router.delete("/tours/{tour_id}/bookings/{booking_id}", status_code=204, summary="Yozilishni bekor qilish")
def delete_booking(tour_id: int, booking_id: int, request: Request, db: Session = Depends(get_db),
                   user: User = Depends(require_manager)):
    b = _booking(db, tour_id, booking_id)
    snap = snapshot(b)
    db.delete(b)
    audit(db, user, "delete", "tour_booking", booking_id, {"before": snap}, request)
    db.commit()
    return Response(status_code=204)


@admin_router.get("/bookings", summary="Barcha yozilishlar (kelgusi ekskursiyalar bo'yicha)")
def all_bookings(upcoming: bool = True, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
                 db: Session = Depends(get_db), _: User = Depends(require_manager)):
    stmt = select(TourBooking).join(Tour)
    if upcoming:
        stmt = stmt.where(Tour.date >= today_local())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Tour.date, Tour.time, TourBooking.created_at)
                      .offset((page - 1) * page_size).limit(page_size)).all()
    items = []
    for b in rows:
        o = booking_out(b)
        o["tour"] = tour_public(b.tour, booked_count(db, b.tour_id))
        items.append(o)
    return page_dict(items, total, page, page_size)
