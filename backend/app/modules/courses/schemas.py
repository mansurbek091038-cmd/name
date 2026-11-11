from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.utils import normalize_uz_phone


class _Base(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


def _alias(data: Any, plain: str) -> Any:
    if isinstance(data, dict) and plain in data and f"{plain}_uz" not in data:
        data = dict(data)
        data[f"{plain}_uz"] = data.pop(plain)
    return data


class CourseIn(_Base):
    title_uz: str = Field(..., min_length=2, max_length=200)
    title_ru: str = Field("", max_length=200)
    title_en: str = Field("", max_length=200)
    description_uz: str = Field("", max_length=5000)
    description_ru: str = Field("", max_length=5000)
    description_en: str = Field("", max_length=5000)
    image_id: int | None = None
    duration: str = Field(..., min_length=1, max_length=100)
    price: int | None = Field(None, ge=0)
    price_text: str = Field("", max_length=100)
    order: int = 0
    is_active: bool = True

    @model_validator(mode="before")
    @classmethod
    def _aliases(cls, data: Any) -> Any:
        return _alias(_alias(data, "title"), "description")


class CourseEnrollIn(_Base):
    name: str = Field(..., min_length=2, max_length=150)
    phone: str = Field(..., max_length=30)
    comment: str | None = Field(None, max_length=500)
    turnstile_token: str | None = Field(None, max_length=4096)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return normalize_uz_phone(v)
