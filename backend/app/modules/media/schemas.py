"""Media object serialisation (shape fixed by the API contract)."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.utils import pick, to_local_iso
from app.modules.media.models import Media


def _pub(m: Media, size: str) -> str | None:
    rel = (m.files or {}).get(size)
    return f"/media/{rel}" if rel else None


def media_out(m: Media | None, lang: str = "uz", admin: bool = False) -> dict | None:
    if m is None:
        return None
    if m.is_private:
        base = f"/api/v1/admin/media/{m.id}/file"
        is_image = m.mime.startswith("image/")
        out = {
            "id": m.id,
            "url": base,
            "thumb": f"{base}?size=thumb" if is_image else None,
            "medium": f"{base}?size=medium" if is_image else None,
            "large": f"{base}?size=large" if is_image else None,
        }
    else:
        out = {
            "id": m.id,
            "url": m.url or _pub(m, "full"),
            "thumb": _pub(m, "thumb"),
            "medium": _pub(m, "medium"),
            "large": _pub(m, "large"),
        }
    out.update({
        "alt": pick(m, "alt", lang) or "",
        "width": m.width,
        "height": m.height,
    })
    if admin:
        out.update({
            "alt_uz": m.alt_uz, "alt_ru": m.alt_ru, "alt_en": m.alt_en,
            "mime": m.mime, "size": m.size, "is_private": m.is_private,
            "album_id": m.album_id, "order": m.order, "original_name": m.original_name,
            "original_url": f"/api/v1/admin/media/{m.id}/file?size=original",
            "created_at": to_local_iso(m.created_at),
        })
    return out


def public_media(db: Session, media_id: int | None, lang: str = "uz") -> dict | None:
    """Expand a media id for public output. Private media is never exposed publicly."""
    if not media_id:
        return None
    m = db.get(Media, media_id)
    if m is None or m.is_private:
        return None
    return media_out(m, lang)


def admin_media(db: Session, media_id: int | None) -> dict | None:
    if not media_id:
        return None
    return media_out(db.get(Media, media_id), admin=True)


def media_map(db: Session, ids: set[int], lang: str = "uz", admin: bool = False) -> dict[int, dict]:
    ids = {i for i in ids if isinstance(i, int)}
    if not ids:
        return {}
    rows = db.scalars(select(Media).where(Media.id.in_(ids))).all()
    return {m.id: media_out(m, lang, admin=admin) for m in rows if admin or not m.is_private}
