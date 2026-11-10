"""Application settings, read from environment variables and the .env file."""
from __future__ import annotations

import logging
import secrets
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]  # .../smart-start/backend
PROJECT_DIR = BACKEND_DIR.parent  # .../smart-start
STATIC_DIR = BACKEND_DIR / "app" / "static"
SEED_ASSETS_DIR = BACKEND_DIR / "seed" / "assets"

log = logging.getLogger("smartstart.config")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_DIR / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        env_ignore_empty=True,
    )

    # --- general ---
    app_env: str = "development"  # development | production
    app_name: str = "Smart Start"
    site_url: str = "http://localhost:8000"
    secret_key: str = ""
    log_level: str = "INFO"

    # --- storage ---
    database_url: str = ""
    data_dir: Path = PROJECT_DIR / "data"
    media_root: Path = PROJECT_DIR / "media"
    backup_dir: Path | None = None
    backup_keep: int = 30
    max_upload_mb: int = 15

    # --- seed ---
    auto_seed: bool = True

    # --- security ---
    cors_origins: str | None = None
    cookie_secure: bool | None = None  # None -> True in production
    trust_proxy: bool = False
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    csp_enabled: bool = True
    content_security_policy: str = ""
    rate_limit_enabled: bool = True

    # --- integrations (can be overridden from the admin settings page) ---
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    telegram_enabled: bool = True
    sms_enabled: bool = False
    eskiz_email: str = ""
    eskiz_password: str = ""
    eskiz_from: str = "4546"
    turnstile_site_key: str = ""
    turnstile_secret: str = ""
    ga4_id: str = ""
    ym_id: str = ""
    meta_pixel_id: str = ""
    sentry_dsn: str = ""

    @field_validator("site_url")
    @classmethod
    def _strip_slash(cls, v: str) -> str:
        return v.rstrip("/")

    @field_validator("data_dir", "media_root", "backup_dir")
    @classmethod
    def _abs_path(cls, v: Path | None) -> Path | None:
        if v is None:
            return None
        v = Path(v).expanduser()
        return v if v.is_absolute() else (PROJECT_DIR / v).resolve()

    @field_validator("database_url")
    @classmethod
    def _sqlite_rel(cls, v: str) -> str:
        # sqlite:///./data/x.db -> absolute path relative to the project root
        if v.startswith("sqlite:///") and not v.startswith("sqlite:////"):
            rel = v[len("sqlite:///"):]
            if rel and rel != ":memory:" and not Path(rel).is_absolute():
                return f"sqlite:///{(PROJECT_DIR / rel).resolve().as_posix()}"
        return v

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in ("prod", "production")

    @property
    def secure_cookies(self) -> bool:
        if self.cookie_secure is None:
            return self.is_production
        return self.cookie_secure

    @property
    def cors_origin_list(self) -> list[str]:
        origins = self.cors_origins
        if origins is None:
            return [] if self.is_production else ["http://localhost:5173", "http://127.0.0.1:5173"]
        return [o.strip().rstrip("/") for o in origins.split(",") if o.strip()]

    @property
    def sqlalchemy_url(self) -> str:
        url = self.database_url.strip()
        if not url:
            return f"sqlite:///{(self.data_dir / 'smartstart.db').as_posix()}"
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg://" + url[len("postgresql://"):]
        return url

    @property
    def is_sqlite(self) -> bool:
        return self.sqlalchemy_url.startswith("sqlite")

    @property
    def public_media_dir(self) -> Path:
        return self.media_root / "public"

    @property
    def private_media_dir(self) -> Path:
        return self.media_root / "private"

    def ensure_dirs(self) -> None:
        for p in (self.data_dir, self.public_media_dir, self.private_media_dir,
                  self.private_media_dir / "originals", self.backup_dir, self.data_dir / "logs"):
            p.mkdir(parents=True, exist_ok=True)


def _resolve_secret(s: Settings) -> None:
    """Use SECRET_KEY from env; otherwise create one and keep it in data/.secret_key."""
    if s.secret_key:
        if len(s.secret_key) >= 16:
            return
    key_file = s.data_dir / ".secret_key"
    if key_file.exists():
        s.secret_key = key_file.read_text().strip()
        if s.secret_key:
            return
    s.secret_key = secrets.token_urlsafe(48)
    key_file.write_text(s.secret_key)
    try:
        key_file.chmod(0o600)
    except OSError:
        pass
    log.warning("SECRET_KEY not set; generated one in %s", key_file)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production:
        site = urlsplit(s.site_url)
        if site.scheme != "https" or not site.hostname or site.path or site.query or site.fragment or site.username:
            raise ValueError("Production SITE_URL must be the HTTPS origin of the site.")
        if len(s.secret_key.encode()) < 32:
            raise ValueError("Production SECRET_KEY must be at least 32 bytes.")
        if not s.secure_cookies:
            raise ValueError("Production requires secure cookies.")
    if s.backup_dir is None:
        s.backup_dir = s.data_dir / "backups"
    s.ensure_dirs()
    _resolve_secret(s)
    return s
