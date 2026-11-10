"""Test setup: isolated temp database + media folder, seeded once per session."""
import os
import sys
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="smartstart-test-"))
os.environ.update({
    "DATA_DIR": str(_TMP / "data"),
    "MEDIA_ROOT": str(_TMP / "media"),
    "BACKUP_DIR": str(_TMP / "backups"),
    # Set TEST_DATABASE_URL=postgresql://... to run the suite against PostgreSQL
    "DATABASE_URL": os.environ.get("TEST_DATABASE_URL") or f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    "SECRET_KEY": "test-secret-key-for-pytest-only-0123456789",
    "AUTO_SEED": "false",
    "APP_ENV": "development",
    "SITE_URL": "https://smartstart.test",
    "TELEGRAM_BOT_TOKEN": "",
    "TELEGRAM_CHAT_ID": "",
    "TURNSTILE_SECRET": "",
    "SMS_ENABLED": "false",
})
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core.ratelimit import limiter  # noqa: E402
from app.main import app  # noqa: E402
from seed.seed import run_seed  # noqa: E402

ADMIN = ("admin@smartstart.uz", "SmartStart2026!")
MANAGER = ("manager@smartstart.uz", "Manager2026!")


@pytest.fixture(scope="session", autouse=True)
def seeded():
    run_seed(reset=True)
    yield


@pytest.fixture(autouse=True)
def _reset_limits():
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture()
def client():
    with TestClient(app, base_url="http://testserver") as c:
        yield c


def login(c: TestClient, creds=ADMIN, **extra) -> dict:
    r = c.post("/api/v1/auth/login", json={"email": creds[0], "password": creds[1], **extra})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture()
def admin(client):
    login(client, ADMIN)
    return client


@pytest.fixture()
def manager_client():
    with TestClient(app, base_url="http://testserver") as c:
        login(c, MANAGER)
        yield c


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
