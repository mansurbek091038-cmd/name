"""Database engine, session, base model and column types."""
from __future__ import annotations

import logging
from collections.abc import Iterator
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, create_engine, event, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.core.config import get_settings

log = logging.getLogger("smartstart.db")

# JSON everywhere, JSONB on PostgreSQL
JSONType = JSON().with_variant(JSONB(), "postgresql")


class UTCDateTime(TypeDecorator):
    """Stores naive UTC, always returns timezone-aware UTC datetimes."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class SchemaVersion(Base):
    __tablename__ = "schema_version"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str] = mapped_column(String(200), default="")


SCHEMA_VERSION = 1

# Simple forward-only migrations: {target_version: callable(connection)}.
MIGRATIONS: dict[int, callable] = {}

_settings = get_settings()
_url = _settings.sqlalchemy_url
_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}
if _url.startswith("sqlite"):
    _engine_kwargs["connect_args"] = {"check_same_thread": False, "timeout": 30}

engine = create_engine(_url, **_engine_kwargs)

if _url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _):  # pragma: no cover - trivial
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA busy_timeout=30000")
        cur.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables and run pending simple migrations."""
    from app import models  # registers all models on Base.metadata

    assert models.__all__
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        row = db.scalar(select(SchemaVersion).limit(1))
        if row is None:
            db.add(SchemaVersion(id=1, version=SCHEMA_VERSION, note="initial"))
            db.commit()
            return
        current = row.version
        for target in sorted(MIGRATIONS):
            if target > current:
                log.info("Running migration to schema v%s", target)
                MIGRATIONS[target](db.connection())
                row.version = target
                db.commit()
        if row.version < SCHEMA_VERSION:
            row.version = SCHEMA_VERSION
            db.commit()
