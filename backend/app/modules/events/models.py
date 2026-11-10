from __future__ import annotations

import datetime as dt
from datetime import datetime

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, UTCDateTime, utcnow

TOUR_TYPES = ("ekskursiya", "ochiq_eshiklar")


class Tour(Base):
    __tablename__ = "tours"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[dt.date] = mapped_column(Date, nullable=False, index=True)
    time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    type: Mapped[str] = mapped_column(String(20), nullable=False, default="ekskursiya")
    note: Mapped[str] = mapped_column(String(300), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    bookings: Mapped[list["TourBooking"]] = relationship(
        back_populates="tour", cascade="all, delete-orphan", order_by="TourBooking.created_at")


class TourBooking(Base):
    __tablename__ = "tour_bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tour_id: Mapped[int] = mapped_column(ForeignKey("tours.id", ondelete="CASCADE"), index=True)
    parent_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    children_count: Mapped[int] = mapped_column(Integer, default=1)
    comment: Mapped[str] = mapped_column(String(500), default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    tour: Mapped[Tour] = relationship(back_populates="bookings")
