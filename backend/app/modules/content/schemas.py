"""Admin input schemas for content resources."""
from __future__ import annotations

import datetime as dt
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.utils import assume_local

CertType = Literal["IELTS", "CEFR", "SAT", "olimpiada", "boshqa"]
CERT_TYPES = ("IELTS", "CEFR", "SAT", "olimpiada", "boshqa")


def normalize_cert_type(v: Any) -> Any:
    if isinstance(v, str):
        low = v.strip().lower()
        for t in CERT_TYPES:
            if t.lower() == low:
                return t
        if low in ("olympiad", "olimpiad"):
            return "olimpiada"
        if low in ("other", "boshqa", "другое"):
            return "boshqa"
    return v


def _url(v: str | None) -> str | None:
    if v in (None, ""):
        return v
    v = v.strip()
    if not (v.startswith("https://") or v.startswith("http://")):
        raise ValueError("Havola http:// yoki https:// bilan boshlanishi kerak")
    return v


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


def _alias(data: Any, plain: str) -> Any:
    """Accept `subject` as an alias of `subject_uz` (TZ uses unsuffixed names for some fields)."""
    if isinstance(data, dict) and plain in data and f"{plain}_uz" not in data:
        data = dict(data)
        data[f"{plain}_uz"] = data.pop(plain)
    return data


class PostIn(_Base):
    type: Literal["news", "event"] = "news"
    slug: str = Field("", max_length=120)
    title_uz: str = Field(..., min_length=1, max_length=300)
    title_ru: str = Field("", max_length=300)
    title_en: str = Field("", max_length=300)
    excerpt_uz: str = Field("", max_length=500)
    excerpt_ru: str = Field("", max_length=500)
    excerpt_en: str = Field("", max_length=500)
    body_uz: str = Field("", max_length=200_000)
    body_ru: str = Field("", max_length=200_000)
    body_en: str = Field("", max_length=200_000)
    cover_id: int | None = None
    event_date: datetime | None = None
    event_location: str = Field("", max_length=300)
    published_at: datetime | None = None

    @field_validator("event_date", "published_at")
    @classmethod
    def _local(cls, v: datetime | None) -> datetime | None:
        return assume_local(v)


class TeacherIn(_Base):
    full_name: str = Field(..., min_length=2, max_length=150)
    subject_uz: str = Field("", max_length=150)
    subject_ru: str = Field("", max_length=150)
    subject_en: str = Field("", max_length=150)
    experience_years: int = Field(0, ge=0, le=70)
    bio_uz: str = Field("", max_length=5000)
    bio_ru: str = Field("", max_length=5000)
    bio_en: str = Field("", max_length=5000)
    badge_uz: str = Field("", max_length=100)
    badge_ru: str = Field("", max_length=100)
    badge_en: str = Field("", max_length=100)
    photo_id: int | None = None
    order: int = 0
    is_visible: bool = True

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _alias(_alias(data, "subject"), "badge")


class PriceIn(_Base):
    grade_range: str = Field(..., min_length=1, max_length=50)
    monthly_fee: int = Field(0, ge=0)
    meals_fee: int = Field(0, ge=0)
    transport_fee: int = Field(0, ge=0)
    note_uz: str = Field("", max_length=500)
    note_ru: str = Field("", max_length=500)
    note_en: str = Field("", max_length=500)
    order: int = 0


class FaqIn(_Base):
    question_uz: str = Field(..., min_length=2, max_length=500)
    question_ru: str = Field("", max_length=500)
    question_en: str = Field("", max_length=500)
    answer_uz: str = Field("", max_length=5000)
    answer_ru: str = Field("", max_length=5000)
    answer_en: str = Field("", max_length=5000)
    order: int = 0
    is_visible: bool = True


class TestimonialIn(_Base):
    author: str = Field(..., min_length=2, max_length=150)
    child_name: str = Field("", max_length=150)
    child_grade: str = Field("", max_length=50)
    photo_id: int | None = None
    date: dt.date | None = None
    text_uz: str = Field(..., min_length=2, max_length=3000)
    text_ru: str = Field("", max_length=3000)
    text_en: str = Field("", max_length=3000)
    order: int = 0
    is_visible: bool = True

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _alias(data, "text")

    @field_validator("child_grade", mode="before")
    @classmethod
    def _grade_str(cls, v: Any) -> Any:
        return str(v) if isinstance(v, int) else v


class Region(BaseModel):
    x: float = Field(..., ge=0, le=1)
    y: float = Field(..., ge=0, le=1)
    w: float = Field(..., gt=0, le=1)
    h: float = Field(..., gt=0, le=1)


class CertificateIn(_Base):
    type: CertType
    score: str = Field(..., min_length=1, max_length=30)
    sub_scores: dict[str, str] = Field(default_factory=dict)
    student_name: str = Field(..., min_length=2, max_length=150)
    grade: int | None = Field(None, ge=0, le=12)
    year: int | None = Field(None, ge=2000, le=2100)
    date: dt.date | None = None
    subject: str = Field("", max_length=100)
    level: str = Field("", max_length=50)
    teacher: str = Field("", max_length=150)
    cert_number: str = Field("", max_length=80)
    image_id: int | None = None
    redact_regions: list[Region] = Field(default_factory=list)
    verify_url: str = Field("", max_length=500)
    parent_consent: bool = False
    consent_file_id: int | None = None
    is_featured: bool = False
    is_new: bool = False
    order: int = 0

    @field_validator("type", mode="before")
    @classmethod
    def _type(cls, v: Any) -> Any:
        return normalize_cert_type(v)

    @field_validator("verify_url")
    @classmethod
    def _verify(cls, v: str | None) -> str | None:
        return _url(v)

    @field_validator("sub_scores", mode="before")
    @classmethod
    def _subs(cls, v: Any) -> Any:
        if v is None:
            return {}
        if isinstance(v, dict):
            allowed = {"listening", "reading", "writing", "speaking", "math", "ebrw"}
            return {k: str(val) for k, val in v.items() if k in allowed and val not in (None, "")}
        return v


class PartnerIn(_Base):
    name: str = Field(..., min_length=2, max_length=200)
    country_uz: str = Field("", max_length=100)
    country_ru: str = Field("", max_length=100)
    country_en: str = Field("", max_length=100)
    country_code: str = Field("", max_length=2)
    logo_id: int | None = None
    qs_rank: int | None = Field(None, ge=1, le=5000)
    qs_year: int | None = Field(None, ge=2000, le=2100)
    description_uz: str = Field("", max_length=3000)
    description_ru: str = Field("", max_length=3000)
    description_en: str = Field("", max_length=3000)
    website_url: str = Field("", max_length=300)
    lat: float | None = Field(None, ge=-90, le=90)
    lng: float | None = Field(None, ge=-180, le=180)
    order: int = 0
    is_visible: bool = True

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _alias(data, "country")

    @field_validator("website_url")
    @classmethod
    def _site(cls, v: str | None) -> str | None:
        return _url(v)

    @field_validator("country_code")
    @classmethod
    def _cc(cls, v: str | None) -> str | None:
        return v.upper() if v else v


class PageIn(_Base):
    blocks_uz: dict | None = None
    blocks_ru: dict | None = None
    blocks_en: dict | None = None
    seo_title_uz: str | None = Field(None, max_length=300)
    seo_title_ru: str | None = Field(None, max_length=300)
    seo_title_en: str | None = Field(None, max_length=300)
    seo_description_uz: str | None = Field(None, max_length=500)
    seo_description_ru: str | None = Field(None, max_length=500)
    seo_description_en: str | None = Field(None, max_length=500)
    og_image_id: int | None = None
