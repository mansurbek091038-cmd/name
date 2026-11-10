"""Serves the built React app (backend/app/static) with SEO tags injected per route."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    JSONResponse,
    PlainTextResponse,
    Response,
)
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.web import seo

router = APIRouter(include_in_schema=False)


@router.api_route("/sitemap.xml", methods=["GET", "HEAD"])
def sitemap(db: Session = Depends(get_db)):
    return Response(seo.sitemap_xml(db), media_type="application/xml",
                    headers={"Cache-Control": "public, max-age=3600"})


@router.api_route("/robots.txt", methods=["GET", "HEAD"])
def robots():
    return PlainTextResponse(seo.robots_txt(), headers={"Cache-Control": "public, max-age=3600"})


@router.api_route("/api/{rest:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])
def api_not_found(rest: str):
    return JSONResponse({"code": "NOT_FOUND", "message": "API manzili topilmadi"}, status_code=404)


@router.api_route("/{full_path:path}", methods=["GET", "HEAD"])
def spa(full_path: str, request: Request, db: Session = Depends(get_db)):
    first = full_path.split("/", 1)[0]
    if first in ("api", "media", "assets"):
        return JSONResponse({"code": "NOT_FOUND", "message": "Topilmadi"}, status_code=404)
    f = seo.static_file(full_path)
    if f is not None:
        return FileResponse(f, headers={"Cache-Control": "public, max-age=86400"})
    lang = request.query_params.get("lang", "uz")
    meta = seo.build_meta(db, "/" + full_path, lang)
    index = seo.read_index()
    body = seo.inject(index, meta) if index else seo.placeholder_page(meta)
    return HTMLResponse(body, status_code=meta.status, headers={"Cache-Control": "no-cache"})
