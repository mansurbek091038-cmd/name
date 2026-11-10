from __future__ import annotations

import datetime as dt
from datetime import datetime

from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, JSONType, UTCDateTime, utcnow


def _media_fk() -> ForeignKey:
    return ForeignKey("media.id", ondelete="SET NULL")


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(10), default="news", index=True)  # news | event
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title_uz: Mapped[str] = mapped_column(String(300), default="")
    title_ru: Mapped[str] = mapped_column(String(300), default="")
    title_en: Mapped[str] = mapped_column(String(300), default="")
    excerpt_uz: Mapped[str] = mapped_column(String(500), default="")
    excerpt_ru: Mapped[str] = mapped_column(String(500), default="")
    excerpt_en: Mapped[str] = mapped_column(String(500), default="")
    body_uz: Mapped[str] = mapped_column(Text, default="")
    body_ru: Mapped[str] = mapped_column(Text, default="")
    body_en: Mapped[str] = mapped_column(Text, default="")
    cover_id: Mapped[int | None] = mapped_column(_media_fk(), nullable=True)
    event_date: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True)
    event_location: Mapped[str] = mapped_column(String(300), default="")
    published_at: Mapped[datetime | None] = mapped_column(UTCDateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    blocks_uz: Mapped[dict] = mapped_column(JSONType, default=dict)
    blocks_ru: Mapped[dict] = mapped_column(JSONType, default=dict)
    blocks_en: Mapped[dict] = mapped_column(JSONType, default=dict)
    seo_title_uz: Mapped[str] = mapped_column(String(300), default="")
    seo_title_ru: Mapped[str] = mapped_column(String(300), default="")
    seo_title_en: Mapped[str] = mapped_column(String(300), default="")
    seo_description_uz: Mapped[str] = mapped_column(String(500), default="")
    seo_description_ru: Mapped[str] = mapped_column(String(500), default="")
    seo_description_en: Mapped[str] = mapped_column(String(500), default="")
    og_image_id: Mapped[int | None] = mapped_column(_media_fk(), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Teacher(Base):
    __tablename__ = "teachers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    photo_id: Mapped[int | None] = mapped_column(_media_fk(), nullable=True)
    full_name: Mapped[str] = mapped_column(String(150), default="")
    subject_uz: Mapped[str] = mapped_column(String(150), default="")
    subject_ru: Mapped[str] = mapped_column(String(150), default="")
    subject_en: Mapped[str] = mapped_column(String(150), default="")
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    bio_uz: Mapped[str] = mapped_column(Text, default="")
    bio_ru: Mapped[str] = mapped_column(Text, default="")
    bio_en: Mapped[str] = mapped_column(Text, default="")
    badge_uz: Mapped[str] = mapped_column(String(100), default="")
    badge_ru: Mapped[str] = mapped_column(String(100), default="")
    badge_en: Mapped[str] = mapped_column(String(100), default="")
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Price(Base):
    __tablename__ = "prices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    grade_range: Mapped[str] = mapped_column(String(50), default="")
    monthly_fee: Mapped[int] = mapped_column(Integer, default=0)
    meals_fee: Mapped[int] = mapped_column(Integer, default=0)
    transport_fee: Mapped[int] = mapped_column(Integer, default=0)
    note_uz: Mapped[str] = mapped_column(String(500), default="")
    note_ru: Mapped[str] = mapped_column(String(500), default="")
    note_en: Mapped[str] = mapped_column(String(500), default="")
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Faq(Base):
    __tablename__ = "faqs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    question_uz: Mapped[str] = mapped_column(String(500), default="")
    question_ru: Mapped[str] = mapped_column(String(500), default="")
    question_en: Mapped[str] = mapped_column(String(500), default="")
    answer_uz: Mapped[str] = mapped_column(Text, default="")
    answer_ru: Mapped[str] = mapped_column(Text, default="")
    answer_en: Mapped[str] = mapped_column(Text, default="")
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Testimonial(Base):
    __tablename__ = "testimonials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    author: Mapped[str] = mapped_column(String(150), default="")
    child_grade: Mapped[str] = mapped_column(String(50), default="")
    text_uz: Mapped[str] = mapped_column(Text, default="")
    text_ru: Mapped[str] = mapped_column(Text, default="")
    text_en: Mapped[str] = mapped_column(Text, default="")
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(20), index=True)  # IELTS|CEFR|SAT|olimpiada|boshqa
    score: Mapped[str] = mapped_column(String(30), default="")
    score_value: Mapped[float] = mapped_column(Float, default=0)  # normalised 0..100 for sorting
    sub_scores: Mapped[dict] = mapped_column(JSONType, default=dict)
    student_name: Mapped[str] = mapped_column(String(150), default="", index=True)
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    subject: Mapped[str] = mapped_column(String(100), default="")
    level: Mapped[str] = mapped_column(String(50), default="")
    teacher: Mapped[str] = mapped_column(String(150), default="")
    cert_number: Mapped[str] = mapped_column(String(80), default="")
    image_id: Mapped[int | None] = mapped_column(_media_fk(), nullable=True)
    original_image_id: Mapped[int | None] = mapped_column(_media_fk(), nullable=True)
    redact_regions: Mapped[list] = mapped_column(JSONType, default=list)
    verify_url: Mapped[str] = mapped_column(String(500), default="")
    parent_consent: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    consent_file_id: Mapped[int | None] = mapped_column(_media_fk(), nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    is_new: Mapped[bool] = mapped_column(Boolean, default=False)
    order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)


class Partner(Base):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), default="")
    country_uz: Mapped[str] = mapped_column(String(100), default="")
    country_ru: Mapped[str] = mapped_column(String(100), default="")
    country_en: Mapped[str] = mapped_column(String(100), default="")
    country_code: Mapped[str] = mapped_column(String(2), default="")
    logo_id: Mapped[int | None] = mapped_column(_media_fk(), nullable=True)
    qs_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    qs_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description_uz: Mapped[str] = mapped_column(Text, default="")
    description_ru: Mapped[str] = mapped_column(Text, default="")
    description_en: Mapped[str] = mapped_column(Text, default="")
    website_url: Mapped[str] = mapped_column(String(300), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
