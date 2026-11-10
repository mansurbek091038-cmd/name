"""Media upload/listing (admin), albums CRUD (admin) and public gallery."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import audit, snapshot
from app.core.crud import crud_router
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import require_manager
from app.core.utils import lang_or_default, paginate, pick
from app.modules.auth.models import User
from app.modules.media.models import Album, Media
from app.modules.media.pipeline import create_media, delete_media_files, file_path
from app.modules.media.schemas import admin_media, media_out, public_media

router = APIRouter(prefix="/admin/media", tags=["admin: media"])
public_router = APIRouter(prefix="/public", tags=["public: gallery"])


def _form_bool(v: str | bool | None) -> bool:
    if isinstance(v, bool):
        return v
    return str(v or "").strip().lower() in ("1", "true", "yes", "on")


@router.post("", status_code=201, summary="Fayl yuklash (rasm → WebP thumb/medium/large)")
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    album_id: int | None = Form(None),
    alt_uz: str | None = Form(None, max_length=300),
    alt_ru: str | None = Form(None, max_length=300),
    alt_en: str | None = Form(None, max_length=300),
    private: str | None = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_manager),
):
    from app.core.config import get_settings

    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    if album_id is not None and db.get(Album, album_id) is None:
        raise AppError(404, "ALBUM_NOT_FOUND", "Albom topilmadi")
    is_private = _form_bool(private)
    order = 0
    if album_id:
        order = (db.scalar(select(func.max(Media.order)).where(Media.album_id == album_id)) or 0) + 1
    m = create_media(db, data, file.filename or "", private=is_private, album_id=album_id,
                     alt_uz=alt_uz or "", alt_ru=alt_ru or "", alt_en=alt_en or "",
                     uploaded_by=user.id, order=order)
    audit(db, user, "upload", "media", m.id, {"name": m.original_name, "private": is_private}, request)
    db.commit()
    return media_out(m, admin=True)


@router.get("", summary="Fayllar ro'yxati")
def list_media(album_id: int | None = None, private: bool | None = None,
               search: str | None = Query(None, max_length=100),
               page: int = Query(1, ge=1), page_size: int = Query(24, ge=1, le=100),
               db: Session = Depends(get_db), _: User = Depends(require_manager)):
    stmt = select(Media)
    if album_id is not None:
        stmt = stmt.where(Media.album_id == album_id)
    if private is not None:
        stmt = stmt.where(Media.is_private.is_(private))
    if search:
        like = f"%{search.strip()}%"
        stmt = stmt.where(or_(Media.original_name.ilike(like), Media.alt_uz.ilike(like)))
    stmt = stmt.order_by(Media.album_id, Media.order, Media.id.desc())
    return paginate(db, stmt, page, page_size, lambda m: media_out(m, admin=True))


@router.get("/{media_id}", summary="Fayl ma'lumoti")
def get_media(media_id: int, db: Session = Depends(get_db), _: User = Depends(require_manager)):
    m = db.get(Media, media_id)
    if m is None:
        raise AppError(404, "NOT_FOUND", "Fayl topilmadi")
    return media_out(m, admin=True)


class MediaUpdate(BaseModel):
    alt_uz: str | None = Field(None, max_length=300)
    alt_ru: str | None = Field(None, max_length=300)
    alt_en: str | None = Field(None, max_length=300)
    album_id: int | None = None
    order: int | None = None


@router.put("/{media_id}", summary="Alt matn / albom / tartibni o'zgartirish")
def update_media(media_id: int, body: MediaUpdate, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(require_manager)):
    m = db.get(Media, media_id)
    if m is None:
        raise AppError(404, "NOT_FOUND", "Fayl topilmadi")
    data = body.model_dump(exclude_unset=True)
    if data.get("album_id") is not None and db.get(Album, data["album_id"]) is None:
        raise AppError(404, "ALBUM_NOT_FOUND", "Albom topilmadi")
    for k, v in data.items():
        setattr(m, k, v if v is not None or k == "album_id" else getattr(m, k))
    audit(db, user, "update", "media", m.id, {"changes": data}, request)
    db.commit()
    return media_out(m, admin=True)


@router.delete("/{media_id}", status_code=204, summary="Faylni o'chirish")
def delete_media(media_id: int, request: Request, db: Session = Depends(get_db),
                 user: User = Depends(require_manager)):
    m = db.get(Media, media_id)
    if m is None:
        raise AppError(404, "NOT_FOUND", "Fayl topilmadi")
    snap = snapshot(m)
    db.delete(m)
    audit(db, user, "delete", "media", media_id, {"before": snap}, request)
    db.commit()
    delete_media_files(m)
    return Response(status_code=204)


@router.get("/{media_id}/file", summary="Faylni yuklab olish (yopiq fayllar ham, faqat xodimlar)")
def media_file(media_id: int, size: str = Query("original", pattern="^(original|full|thumb|medium|large)$"),
               db: Session = Depends(get_db), _: User = Depends(require_manager)):
    m = db.get(Media, media_id)
    if m is None:
        raise AppError(404, "NOT_FOUND", "Fayl topilmadi")
    p = file_path(m, size)
    if p is None:
        raise AppError(404, "NOT_FOUND", "Fayl diskda topilmadi")
    media_type = m.mime if size == "original" else "image/webp"
    if p.suffix == ".pdf":
        media_type = "application/pdf"
    return FileResponse(p, media_type=media_type, headers={"Cache-Control": "private, no-store"})


# ---------------- albums ----------------
class AlbumIn(BaseModel):
    title_uz: str = Field("", max_length=200)
    title_ru: str = Field("", max_length=200)
    title_en: str = Field("", max_length=200)
    cover_id: int | None = None
    order: int = 0
    is_visible: bool = True


def _album_admin(db: Session, a: Album) -> dict:
    count = db.scalar(select(func.count()).select_from(Media).where(Media.album_id == a.id)) or 0
    return {"id": a.id, "title_uz": a.title_uz, "title_ru": a.title_ru, "title_en": a.title_en,
            "cover_id": a.cover_id, "cover": admin_media(db, a.cover_id), "order": a.order,
            "is_visible": a.is_visible, "count": count}


def _album_prepare(db: Session, data: dict, obj, user) -> dict:
    if data.get("cover_id") and db.get(Media, data["cover_id"]) is None:
        raise AppError(404, "MEDIA_NOT_FOUND", "Muqova rasmi topilmadi")
    return data


albums_router = crud_router(
    prefix="/admin/albums", tag="admin: albums", model=Album, entity="album", create_schema=AlbumIn,
    to_admin=_album_admin, search_fields=("title_uz", "title_ru", "title_en"), prepare=_album_prepare,
)


def _first_media_id(db: Session, album_id: int) -> int | None:
    return db.scalar(select(Media.id).where(Media.album_id == album_id, Media.is_private.is_(False))
                     .order_by(Media.order, Media.id).limit(1))


@public_router.get("/albums", summary="Galereya albomlari")
def public_albums(lang: str = "uz", db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    albums = db.scalars(select(Album).where(Album.is_visible.is_(True)).order_by(Album.order, Album.id)).all()
    out = []
    for a in albums:
        count = db.scalar(select(func.count()).select_from(Media).where(
            Media.album_id == a.id, Media.is_private.is_(False))) or 0
        cover = public_media(db, a.cover_id or _first_media_id(db, a.id), lang)
        out.append({"id": a.id, "title": pick(a, "title", lang), "cover": cover, "count": count})
    return out


@public_router.get("/albums/{album_id}", summary="Albom rasmlari")
def public_album(album_id: int, lang: str = "uz", db: Session = Depends(get_db)):
    lang = lang_or_default(lang)
    a = db.get(Album, album_id)
    if a is None or not a.is_visible:
        raise AppError(404, "NOT_FOUND", "Albom topilmadi")
    items = db.scalars(select(Media).where(Media.album_id == a.id, Media.is_private.is_(False))
                       .order_by(Media.order, Media.id)).all()
    return {"id": a.id, "title": pick(a, "title", lang), "items": [media_out(m, lang) for m in items]}
