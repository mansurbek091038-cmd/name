"""Smart Start backend — FastAPI application entry point.

Run (from the backend/ folder):  uvicorn app.main:app --port 8000
"""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select, text

from app import __version__
from app.core.config import BACKEND_DIR, STATIC_DIR, get_settings
from app.core.db import SessionLocal, engine, init_db
from app.core.errors import install_error_handlers
from app.core.middleware import SecurityHeadersMiddleware

if str(BACKEND_DIR) not in sys.path:  # makes the `seed` package importable
    sys.path.insert(0, str(BACKEND_DIR))

settings = get_settings()
log = logging.getLogger("smartstart")


def setup_logging() -> None:
    root = logging.getLogger()
    if getattr(root, "_smartstart", False):
        return
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    fmt = logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    sh = logging.StreamHandler()
    sh.setFormatter(fmt)
    fh = RotatingFileHandler(settings.data_dir / "logs" / "app.log", maxBytes=5_000_000, backupCount=5,
                             encoding="utf-8")
    fh.setFormatter(fmt)
    root.addHandler(sh)
    root.addHandler(fh)
    root.setLevel(level)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    root._smartstart = True  # type: ignore[attr-defined]


def setup_sentry() -> None:
    if not settings.sentry_dsn:
        return
    try:
        import sentry_sdk

        sentry_sdk.init(dsn=settings.sentry_dsn, traces_sample_rate=0.0, environment=settings.app_env)
        log.info("Sentry enabled")
    except ImportError:
        log.warning("SENTRY_DSN is set but sentry-sdk is not installed (pip install sentry-sdk)")


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    setup_sentry()
    init_db()
    if settings.auto_seed and not settings.is_production:
        from app.modules.auth.models import User

        with SessionLocal() as db:
            empty = db.scalar(select(User.id).limit(1)) is None
        if empty:
            from seed.seed import run_seed

            log.info("Empty database: loading demo/seed data…")
            run_seed(reset=False)
    log.info("Smart Start backend %s ready (db: %s)", __version__,
             "sqlite" if settings.is_sqlite else "postgresql")
    try:
        yield
    finally:
        engine.dispose()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Smart Start API",
        version=__version__,
        description="Smart Start xususiy maktabi sayti uchun backend API. "
                    "Admin endpointlar uchun avval `/api/v1/auth/login` orqali kiring "
                    "(cookie avtomatik o'rnatiladi) yoki «Authorize» tugmasiga access tokenni qo'ying.",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
        swagger_ui_parameters={"persistAuthorization": True, "displayRequestDuration": True},
    )
    install_error_handlers(app)

    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "Accept-Language", "X-Requested-With"],
        expose_headers=["Content-Disposition", "Retry-After"],
        max_age=600,
    )
    app.add_middleware(SecurityHeadersMiddleware)

    from app.modules.admissions import router as admissions
    from app.modules.auth import router as auth
    from app.modules.content import router_admin as content_admin
    from app.modules.content import router_public as content_public
    from app.modules.courses import router as courses
    from app.modules.events import router as events
    from app.modules.media import router as media
    from app.modules.notifications import router as notifications
    from app.modules.reports import router as reports
    from app.web import spa
    from app.web.media import PublicMediaFiles

    api = APIRouter(prefix="/api/v1")

    @api.get("/health", tags=["system"], summary="Holat tekshiruvi (monitoring uchun)")
    def health():
        db_ok = True
        try:
            with SessionLocal() as db:
                db.execute(text("SELECT 1"))
        except Exception:
            db_ok = False
        return JSONResponse(
            {"status": "ok" if db_ok else "degraded", "db": "ok" if db_ok else "error",
             "version": __version__},
            status_code=200 if db_ok else 503,
        )

    api.add_api_route("/health", health, methods=["HEAD"], include_in_schema=False)

    for r in (
        auth.router, auth.users_router,
        content_public.router, admissions.public_router, courses.public_router, events.public_router,
        media.public_router, notifications.public_router,
        admissions.admin_router, courses.admin_courses_router, courses.admin_enrollments_router,
        content_admin.posts_router, content_admin.teachers_router, content_admin.prices_router,
        content_admin.faqs_router, content_admin.testimonials_router, content_admin.partners_router,
        content_admin.extra_router, content_admin.certificates_router, content_admin.pages_router,
        media.router, media.albums_router,
        events.tours_router, events.admin_router,
        reports.router, notifications.admin_router,
    ):
        api.include_router(r)
    app.include_router(api)

    settings.public_media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media/public", PublicMediaFiles(directory=settings.public_media_dir), name="media")
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets", check_dir=False), name="assets")
    app.include_router(spa.router)  # must be last: catch-all for the SPA
    return app


app = create_app()
