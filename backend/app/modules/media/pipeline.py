"""Image pipeline: keep the original privately, publish compressed WebP variants."""
from __future__ import annotations

import io
import logging
import mimetypes
import secrets
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.modules.media.models import Media

log = logging.getLogger("smartstart.media")

Image.MAX_IMAGE_PIXELS = 60_000_000  # protects against decompression bombs

VARIANTS = {"thumb": 400, "medium": 960, "large": 1920}
FULL_MAX = 2560
QUALITY = {"thumb": 74, "medium": 80, "large": 82, "full": 84}
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp", "GIF": ".gif", "MPO": ".jpg"}


def _media_root() -> Path:
    return get_settings().media_root


def _resize_to_width(img: Image.Image, width: int) -> Image.Image:
    if img.width <= width:
        return img
    h = max(1, round(img.height * width / img.width))
    return img.resize((width, h), Image.LANCZOS)


def _pixelate_regions(img: Image.Image, regions: list[dict]) -> Image.Image:
    """Hide personal data. Regions are fractions of the image: {x, y, w, h} in 0..1."""
    img = img.copy()
    for r in regions or []:
        try:
            x = max(0.0, min(1.0, float(r.get("x", 0))))
            y = max(0.0, min(1.0, float(r.get("y", 0))))
            w = max(0.0, min(1.0 - x, float(r.get("w", 0))))
            h = max(0.0, min(1.0 - y, float(r.get("h", 0))))
        except (TypeError, ValueError):
            continue
        box = (int(x * img.width), int(y * img.height),
               int((x + w) * img.width), int((y + h) * img.height))
        if box[2] - box[0] < 2 or box[3] - box[1] < 2:
            continue
        part = img.crop(box)
        small = part.resize((max(1, part.width // 18), max(1, part.height // 18)), Image.BILINEAR)
        part = small.resize(part.size, Image.NEAREST).filter(ImageFilter.GaussianBlur(2))
        img.paste(part, box)
    return img


def _save_webp(img: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=4)


def _open_image(data: bytes) -> tuple[Image.Image, str]:
    try:
        probe = Image.open(io.BytesIO(data))
        fmt = probe.format
        probe.verify()
        img = Image.open(io.BytesIO(data))
        img.load()
    except Image.DecompressionBombError:
        raise AppError(400, "IMAGE_TOO_LARGE", "Rasm o'lchami juda katta") from None
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError):
        raise AppError(415, "UNSUPPORTED_MEDIA_TYPE",
                       "Fayl rasm emas yoki buzilgan (JPG, PNG, WebP, GIF qabul qilinadi)") from None
    if fmt not in ALLOWED_FORMATS:
        raise AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Faqat JPG, PNG, WebP yoki GIF rasmlar qabul qilinadi")
    if getattr(img, "is_animated", False):
        img.seek(0)
    img = ImageOps.exif_transpose(img)
    has_alpha = img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info)
    img = img.convert("RGBA" if has_alpha else "RGB")
    return img, fmt


def store_upload(data: bytes, filename: str = "", *, private: bool = False,
                 redact: list[dict] | None = None) -> dict:
    """Process an upload. Returns the column values for a new Media row (not yet saved)."""
    s = get_settings()
    if not data:
        raise AppError(400, "EMPTY_FILE", "Fayl bo'sh")
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise AppError(413, "PAYLOAD_TOO_LARGE", f"Fayl hajmi {s.max_upload_mb} MB dan oshmasligi kerak")

    key = secrets.token_hex(8)
    root = _media_root()
    files: dict[str, str] = {}

    if data[:5] == b"%PDF-":
        if not private:
            raise AppError(415, "UNSUPPORTED_MEDIA_TYPE", "PDF faqat yopiq (private) fayl sifatida yuklanadi")
        rel = f"private/{key}.pdf"
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_bytes(data)
        files["original"] = rel
        return {"key": key, "url": "", "mime": "application/pdf", "size": len(data), "width": None,
                "height": None, "is_private": True, "files": files,
                "original_name": (filename or "")[:255]}

    img, fmt = _open_image(data)
    ext = ALLOWED_FORMATS[fmt]
    orig_rel = f"private/originals/{key}{ext}"
    (root / orig_rel).parent.mkdir(parents=True, exist_ok=True)
    (root / orig_rel).write_bytes(data)
    files["original"] = orig_rel

    if redact:
        img = _pixelate_regions(img, redact)

    folder = "private" if private else "public"
    full = _resize_to_width(img, FULL_MAX)
    full_rel = f"{folder}/{key}.webp"
    _save_webp(full, root / full_rel, QUALITY["full"])
    files["full"] = full_rel
    for name, width in VARIANTS.items():
        rel = f"{folder}/{key}_{name}.webp"
        _save_webp(_resize_to_width(full, width), root / rel, QUALITY[name])
        files[name] = rel

    mime = mimetypes.types_map.get(ext, "image/" + fmt.lower())
    return {
        "key": key,
        "url": "" if private else f"/media/{full_rel}",
        "mime": mime,
        "size": len(data),
        "width": full.width,
        "height": full.height,
        "is_private": private,
        "files": files,
        "original_name": (filename or "")[:255],
    }


def create_media(db: Session, data: bytes, filename: str = "", *, private: bool = False,
                 redact: list[dict] | None = None, **extra) -> Media:
    values = store_upload(data, filename, private=private, redact=redact)
    values.update({k: v for k, v in extra.items() if v is not None})
    m = Media(**values)
    db.add(m)
    db.flush()
    return m


def original_bytes(m: Media) -> bytes:
    rel = (m.files or {}).get("original")
    if not rel:
        raise AppError(404, "NOT_FOUND", "Asl fayl topilmadi")
    p = _media_root() / rel
    if not p.exists():
        raise AppError(404, "NOT_FOUND", "Asl fayl topilmadi")
    return p.read_bytes()


def derive_public_copy(db: Session, src: Media, redact: list[dict] | None = None, **extra) -> Media:
    """Create a compressed public copy (optionally with hidden regions) of a stored original."""
    values = {"alt_uz": src.alt_uz, "alt_ru": src.alt_ru, "alt_en": src.alt_en}
    values.update(extra)
    return create_media(db, original_bytes(src), src.original_name, private=False, redact=redact, **values)


def delete_media_files(m: Media) -> None:
    root = _media_root().resolve()
    for rel in (m.files or {}).values():
        try:
            p = (root / rel).resolve()
            if root in p.parents and p.exists():
                p.unlink()
        except OSError as e:  # pragma: no cover
            log.warning("Could not delete %s: %s", rel, e)


def file_path(m: Media, size: str = "original") -> Path | None:
    files = m.files or {}
    rel = files.get(size) or files.get("full") or files.get("original")
    if not rel:
        return None
    p = (_media_root() / rel).resolve()
    if _media_root().resolve() not in p.parents or not p.exists():
        return None
    return p
