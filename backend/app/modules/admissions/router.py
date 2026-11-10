"""Admissions: public application form, contact form and the admin CRM."""
from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import audit, diff, snapshot
from app.core.db import get_db
from app.core.errors import AppError
from app.core.ratelimit import client_ip, enforce
from app.core.security import require_admin, require_manager
from app.core.utils import (
    assume_local,
    local_day_bounds_utc,
    normalize_uz_phone,
    page_dict,
    to_local_iso,
    today_local,
)
from app.modules.admissions.models import (
    STATUSES,
    Admission,
    AdmissionNote,
    ContactMessage,
)
from app.modules.auth.models import AuditLog, User
from app.modules.auth.schemas import user_ref
from app.modules.notifications import service as notify

public_router = APIRouter(prefix="/public", tags=["public: admissions"])
admin_router = APIRouter(prefix="/admin", tags=["admin: admissions"])


# ---------------- schemas ----------------
class _In(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class AdmissionIn(_In):
    parent_name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., max_length=30)
    child_name: str = Field(..., min_length=2, max_length=150)
    birth_year: int | None = Field(None, ge=2000, le=2030)
    target_grade: int = Field(..., ge=0, le=11)
    comment: str | None = Field(None, max_length=2000)
    utm_source: str | None = Field(None, max_length=100)
    utm_campaign: str | None = Field(None, max_length=150)
    turnstile_token: str | None = Field(None, max_length=4096)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_uz_phone(v)

    @field_validator("utm_source", "utm_campaign")
    @classmethod
    def _utm(cls, v: str | None) -> str | None:
        return v.strip().lower()[:150] or None if v else None


class ContactIn(_In):
    name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., max_length=30)
    message: str = Field(..., min_length=2, max_length=2000)
    turnstile_token: str | None = Field(None, max_length=4096)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_uz_phone(v)


class AdmissionPatch(_In):
    status: str | None = None
    assigned_to: int | None = None
    next_call_at: datetime | None = None

    @field_validator("status")
    @classmethod
    def _status(cls, v: str | None) -> str | None:
        if v is not None and v not in STATUSES:
            raise ValueError("Holat noto'g'ri: " + ", ".join(STATUSES))
        return v


    @field_validator("next_call_at")
    @classmethod
    def _local(cls, v: datetime | None) -> datetime | None:
        return assume_local(v)


class NoteIn(_In):
    text: str = Field(..., min_length=1, max_length=5000)


# ---------------- public ----------------
@public_router.post("/admissions", status_code=201, summary="Qabul arizasi (5 ta/soat/IP)")
def create_admission(body: AdmissionIn, request: Request, background: BackgroundTasks,
                     db: Session = Depends(get_db)):
    ip = client_ip(request)
    enforce(request, "admissions", 5, 3600)
    notify.verify_turnstile(db, body.turnstile_token, ip)
    a = Admission(
        parent_name=body.parent_name, phone=body.phone, child_name=body.child_name,
        birth_year=body.birth_year, target_grade=body.target_grade, comment=body.comment or "",
        utm_source=body.utm_source, utm_campaign=body.utm_campaign, ip=ip, status="new",
    )
    db.add(a)
    db.flush()
    a.number = f"SS-{today_local().year}-{a.id:05d}"
    db.commit()
    background.add_task(notify.notify_new_admission, a.id)
    background.add_task(notify.sms_admission_confirmation, a.id)
    return {"id": a.id, "number": a.number,
            "message": "Rahmat! Arizangiz qabul qilindi. Menejerimiz 1 ish kuni ichida siz bilan bog'lanadi."}


@public_router.post("/contact", status_code=201, summary="Aloqa formasi")
def contact(body: ContactIn, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    ip = client_ip(request)
    enforce(request, "contact", 5, 3600)
    notify.verify_turnstile(db, body.turnstile_token, ip)
    m = ContactMessage(name=body.name, phone=body.phone, message=body.message, ip=ip)
    db.add(m)
    db.commit()
    background.add_task(notify.notify_contact, m.id)
    return {"id": m.id, "message": "Xabaringiz yuborildi. Tez orada bog'lanamiz."}


# ---------------- admin ----------------
def admission_out(a: Admission, notes_count: int | None = None) -> dict:
    return {
        "id": a.id, "number": a.number, "parent_name": a.parent_name, "phone": a.phone,
        "child_name": a.child_name, "birth_year": a.birth_year, "target_grade": a.target_grade,
        "comment": a.comment, "status": a.status, "assigned_to": user_ref(a.assigned_to),
        "next_call_at": to_local_iso(a.next_call_at), "utm_source": a.utm_source,
        "utm_campaign": a.utm_campaign, "created_at": to_local_iso(a.created_at),
        "updated_at": to_local_iso(a.updated_at),
        "notes_count": notes_count if notes_count is not None else len(a.notes),
    }


def filtered_admissions(status: str | None = None, assigned_to: str | None = None,
                        search: str | None = None, source: str | None = None,
                        date_from: date | None = None, date_to: date | None = None,
                        target_grade: int | None = None, current_user: User | None = None):
    stmt = select(Admission)
    if status:
        statuses = [s for s in status.split(",") if s in STATUSES]
        if statuses:
            stmt = stmt.where(Admission.status.in_(statuses))
    if assigned_to:
        if assigned_to in ("none", "null", "0"):
            stmt = stmt.where(Admission.assigned_to_id.is_(None))
        elif assigned_to == "me" and current_user:
            stmt = stmt.where(Admission.assigned_to_id == current_user.id)
        elif assigned_to.isdigit():
            stmt = stmt.where(Admission.assigned_to_id == int(assigned_to))
    if search:
        s = search.strip()
        like = f"%{s}%"
        conds = [Admission.parent_name.ilike(like), Admission.child_name.ilike(like),
                 Admission.number.ilike(like), Admission.comment.ilike(like)]
        digits = "".join(ch for ch in s if ch.isdigit())
        if len(digits) >= 3:
            conds.append(Admission.phone.like(f"%{digits}%"))
        stmt = stmt.where(or_(*conds))
    if source:
        if source in ("direct", "none", "sayt"):
            stmt = stmt.where(Admission.utm_source.is_(None))
        else:
            stmt = stmt.where(Admission.utm_source == source.lower())
    if date_from:
        stmt = stmt.where(Admission.created_at >= local_day_bounds_utc(date_from)[0])
    if date_to:
        stmt = stmt.where(Admission.created_at < local_day_bounds_utc(date_to)[1])
    if target_grade is not None:
        stmt = stmt.where(Admission.target_grade == target_grade)
    return stmt


class AdmissionFilters:
    def __init__(self, status: str | None = Query(None, description="new,contacted,..."),
                 assigned_to: str | None = Query(None, description="user id | me | none"),
                 search: str | None = Query(None, max_length=100),
                 source: str | None = Query(None, description="utm_source; 'direct' = manbasiz"),
                 date_from: date | None = None, date_to: date | None = None,
                 target_grade: int | None = Query(None, ge=0, le=11)):
        self.kw = dict(status=status, assigned_to=assigned_to, search=search, source=source,
                       date_from=date_from, date_to=date_to, target_grade=target_grade)


def _get(db: Session, admission_id: int) -> Admission:
    a = db.get(Admission, admission_id)
    if a is None:
        raise AppError(404, "NOT_FOUND", "Ariza topilmadi")
    return a


@admin_router.get("/admissions/export", summary="Arizalarni Excel (.xlsx) ga eksport (admin)")
def export_admissions(request: Request, f: AdmissionFilters = Depends(), db: Session = Depends(get_db),
                      user: User = Depends(require_admin)):
    from app.modules.reports.service import admissions_xlsx

    stmt = filtered_admissions(**f.kw, current_user=user).order_by(Admission.created_at.desc())
    rows = db.scalars(stmt).unique().all()
    data = admissions_xlsx(db, rows)
    audit(db, user, "export", "admission", None, {"count": len(rows), "filters": {k: v for k, v in f.kw.items() if v}},
          request)
    db.commit()
    fname = f"arizalar-{today_local().isoformat()}.xlsx"
    return StreamingResponse(
        iter([data]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"', "Cache-Control": "no-store"},
    )


@admin_router.get("/admissions", summary="Arizalar ro'yxati (CRM)")
def list_admissions(f: AdmissionFilters = Depends(), page: int = Query(1, ge=1),
                    page_size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
                    user: User = Depends(require_manager)):
    stmt = filtered_admissions(**f.kw, current_user=user)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Admission.created_at.desc(), Admission.id.desc())
                      .offset((page - 1) * page_size).limit(page_size)).unique().all()
    ids = [a.id for a in rows]
    counts = dict(db.execute(select(AdmissionNote.admission_id, func.count())
                             .where(AdmissionNote.admission_id.in_(ids))
                             .group_by(AdmissionNote.admission_id)).all()) if ids else {}
    return page_dict([admission_out(a, counts.get(a.id, 0)) for a in rows], total, page, page_size)


def _history(db: Session, admission_id: int) -> list[dict]:
    rows = db.scalars(select(AuditLog).where(AuditLog.entity == "admission", AuditLog.entity_id == admission_id)
                      .order_by(AuditLog.id)).unique().all()
    return [{"id": r.id, "action": r.action, "user": user_ref(r.user), "details": r.details,
             "created_at": to_local_iso(r.created_at)} for r in rows]


def admission_detail(db: Session, a: Admission) -> dict:
    out = admission_out(a)
    out["notes"] = [{"id": n.id, "author": user_ref(n.author), "text": n.text,
                     "created_at": to_local_iso(n.created_at)} for n in a.notes]
    out["history"] = _history(db, a.id)
    return out


@admin_router.get("/admissions/{admission_id}", summary="Ariza tafsilotlari, izohlar va tarix")
def get_admission(admission_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    return admission_detail(db, _get(db, admission_id))


FIELDS = ["status", "assigned_to_id", "next_call_at"]


@admin_router.patch("/admissions/{admission_id}", summary="Holat / mas'ul / qayta qo'ng'iroq vaqti")
def patch_admission(admission_id: int, body: AdmissionPatch, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(require_manager)):
    a = _get(db, admission_id)
    before = snapshot(a, FIELDS)
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        a.status = data["status"]
    if "assigned_to" in data:
        uid = data["assigned_to"]
        if uid is not None:
            target = db.get(User, uid)
            if target is None or not target.is_active:
                raise AppError(422, "VALIDATION_ERROR", "Mas'ul xodim topilmadi",
                               extra={"fields": {"assigned_to": "Faol xodim tanlang"}})
        a.assigned_to_id = uid
    if "next_call_at" in data:
        a.next_call_at = data["next_call_at"]
    db.flush()
    changes = diff(before, snapshot(a, FIELDS))
    if "assigned_to_id" in changes:
        ch = changes.pop("assigned_to_id")
        names = {u.id: u.full_name for u in db.scalars(select(User).where(
            User.id.in_([x for x in (ch["from"], ch["to"]) if x]))).all()}
        changes["assigned_to"] = {"from": names.get(ch["from"]), "to": names.get(ch["to"])}
    if changes:
        audit(db, user, "update", "admission", a.id, {"changes": changes}, request)
    db.commit()
    db.refresh(a)
    return admission_detail(db, a)


@admin_router.post("/admissions/{admission_id}/notes", status_code=201, summary="Izoh qo'shish")
def add_note(admission_id: int, body: NoteIn, request: Request, db: Session = Depends(get_db),
             user: User = Depends(require_manager)):
    a = _get(db, admission_id)
    n = AdmissionNote(admission_id=a.id, author_id=user.id, text=body.text)
    db.add(n)
    db.flush()
    audit(db, user, "note", "admission", a.id, {"note_id": n.id}, request)
    db.commit()
    return {"id": n.id, "author": user_ref(user), "text": n.text, "created_at": to_local_iso(n.created_at)}


@admin_router.delete("/admissions/{admission_id}", status_code=204, summary="Arizani o'chirish (admin)")
def delete_admission(admission_id: int, request: Request, db: Session = Depends(get_db),
                     user: User = Depends(require_admin)):
    a = _get(db, admission_id)
    snap = snapshot(a)
    db.delete(a)
    audit(db, user, "delete", "admission", admission_id, {"before": snap}, request)
    db.commit()
    return Response(status_code=204)


# ---------------- contact messages ----------------
@admin_router.get("/contact-messages", summary="Aloqa formasidan kelgan xabarlar")
def contact_messages(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                     db: Session = Depends(get_db), _: User = Depends(require_manager)):
    stmt = select(ContactMessage).order_by(ContactMessage.id.desc())
    total = db.scalar(select(func.count()).select_from(ContactMessage)) or 0
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return page_dict([{"id": m.id, "name": m.name, "phone": m.phone, "message": m.message,
                       "is_handled": m.is_handled, "created_at": to_local_iso(m.created_at)} for m in rows],
                     total, page, page_size)


class HandledIn(BaseModel):
    is_handled: bool


@admin_router.patch("/contact-messages/{message_id}", summary="Xabarni ko'rib chiqilgan deb belgilash")
def mark_contact(message_id: int, body: HandledIn, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(require_manager)):
    m = db.get(ContactMessage, message_id)
    if m is None:
        raise AppError(404, "NOT_FOUND", "Xabar topilmadi")
    m.is_handled = body.is_handled
    audit(db, user, "update", "contact_message", m.id, {"is_handled": body.is_handled}, request)
    db.commit()
    return {"id": m.id, "is_handled": m.is_handled}
