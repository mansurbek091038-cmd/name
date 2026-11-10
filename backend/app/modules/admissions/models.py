from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, UTCDateTime, utcnow
from app.modules.auth.models import User

STATUSES = ("new", "contacted", "tour_scheduled", "interview", "contract", "rejected")
STATUS_LABELS = {
    "new": "🟡 Yangi",
    "contacted": "📞 Bog'lanildi",
    "tour_scheduled": "🏫 Ekskursiya belgilandi",
    "interview": "💬 Suhbat",
    "contract": "🟢 Shartnoma",
    "rejected": "🔴 Rad etildi",
}


class Admission(Base):
    __tablename__ = "admissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str | None] = mapped_column(String(30), unique=True, index=True, nullable=True)
    parent_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    child_name: Mapped[str] = mapped_column(String(150), nullable=False)
    birth_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_grade: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    comment: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="new", index=True)
    assigned_to_id: Mapped[int | None] = mapped_column(
        "assigned_to", ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    next_call_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    utm_source: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    utm_campaign: Mapped[str | None] = mapped_column(String(150), nullable=True)
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    assigned_to: Mapped[User | None] = relationship(lazy="joined")
    notes: Mapped[list["AdmissionNote"]] = relationship(
        back_populates="admission", cascade="all, delete-orphan", order_by="AdmissionNote.created_at")


class AdmissionNote(Base):
    __tablename__ = "admission_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admission_id: Mapped[int] = mapped_column(ForeignKey("admissions.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    admission: Mapped[Admission] = relationship(back_populates="notes")
    author: Mapped[User | None] = relationship(lazy="joined")


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, default="")
    is_handled: Mapped[bool] = mapped_column(default=False)
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, index=True)
