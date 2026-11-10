"""Serve public media while enforcing current certificate consent."""
import re

import anyio
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from app.core.db import SessionLocal
from app.modules.content.models import Certificate
from app.modules.media.models import Media

_IMAGE = re.compile(r"([0-9a-f]{16})(?:_(?:thumb|medium|large))?\.webp")


def _certificate_consents(key: str) -> list[bool]:
    with SessionLocal() as db:
        return list(db.scalars(
            select(Certificate.parent_consent)
            .join(Media, Certificate.image_id == Media.id)
            .where(Media.key == key)
        ))


class PublicMediaFiles(StaticFiles):
    async def get_response(self, path, scope):
        image = _IMAGE.fullmatch(path)
        consents = await anyio.to_thread.run_sync(_certificate_consents, image[1]) if image else []
        if consents and not all(consents):
            return JSONResponse(
                {"code": "NOT_FOUND", "message": "Topilmadi"},
                status_code=404,
                headers={"Cache-Control": "no-store"},
            )
        response = await super().get_response(path, scope)
        if consents:
            response.headers["Cache-Control"] = "no-store"
        return response
