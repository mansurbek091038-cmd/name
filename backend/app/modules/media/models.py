from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, JSONType, UTCDateTime, utcnow


class Album(Base):
    __tablename__ = "albums"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title_uz: Mapped[str] = mapped_column(String(200), default="")
    title_ru: Mapped[str] = mapped_column(String(200), default="")
    title_en: Mapped[str] = mapped_column(String(200), default="")
    cover_id: Mapped[int | None] = mapped_column(
        ForeignKey("media.id", ondelete="SET NULL", use_alter=True, name="fk_album_cover"),
        nullable=True)
    order: Mapped[int] = mapped_column(Integer, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Media(Base):
    __tablename__ = "media"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    url: Mapped[str] = mapped_column(String(300), default="")  # public URL ('' for private)
    mime: Mapped[str] = mapped_column(String(100), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    # Relative paths under MEDIA_ROOT: {"original": ..., "full": ..., "thumb": ..., ...}
    files: Mapped[dict] = mapped_column(JSONType, default=dict)
    original_name: Mapped[str] = mapped_column(String(255), default="")
    album_id: Mapped[int | None] = mapped_column(ForeignKey("albums.id", ondelete="SET NULL"),
                                                 nullable=True, index=True)
    alt_uz: Mapped[str] = mapped_column(String(300), default="")
    alt_ru: Mapped[str] = mapped_column(String(300), default="")
    alt_en: Mapped[str] = mapped_column(String(300), default="")
    order: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"),
                                                    nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
