import time
from datetime import datetime, timedelta, timezone

import jwt
import pyotp
from fastapi.testclient import TestClient

from app.core.db import SessionLocal
from app.main import app
from app.modules.auth.models import User
from tests.conftest import ADMIN, MANAGER, bearer, login


def test_login_sets_cookies_and_me(client):
    data = login(client)
    assert data["token_type"] == "bearer" and data["expires_in"] == 900
    assert data["requires_2fa"] is False
    assert set(data["user"]) >= {"id", "email", "full_name", "role", "is_active", "two_fa_enabled", "created_at"}
    assert client.cookies.get("ss_access") and client.cookies.get("ss_refresh")
    assert client.get("/api/v1/auth/me").json()["role"] == "super_admin"


def test_bearer_header_works_without_cookie(client):
    token = login(client)["access_token"]
    client.cookies.clear()
    assert client.get("/api/v1/auth/me").status_code == 401
    r = client.get("/api/v1/auth/me", headers=bearer(token))
    assert r.status_code == 200 and r.json()["email"] == ADMIN[0]


def test_wrong_password(client):
    r = client.post("/api/v1/auth/login", json={"email": ADMIN[0], "password": "nope"})
    assert r.status_code == 401 and r.json()["code"] == "INVALID_CREDENTIALS"
    r = client.post("/api/v1/auth/login", json={"email": "ghost@smartstart.uz", "password": "x"})
    assert r.status_code == 401 and r.json()["code"] == "INVALID_CREDENTIALS"


def test_login_bruteforce_limited(client):
    codes = [client.post("/api/v1/auth/login", json={"email": MANAGER[0], "password": "bad"}).status_code
             for _ in range(9)]
    assert codes[-1] == 429


def test_refresh_rotates_and_detects_reuse(client):
    login(client)
    old_refresh = client.cookies.get("ss_refresh")
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 200 and r.json()["access_token"]
    new_refresh = client.cookies.get("ss_refresh")
    assert new_refresh and new_refresh != old_refresh
    # body form works too
    with TestClient(app) as other:
        r2 = other.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
        assert r2.status_code == 401 and r2.json()["code"] == "TOKEN_REUSED"
    # reuse revoked every session of that user, including the newest refresh token
    assert client.post("/api/v1/auth/refresh").status_code == 401


def test_logout_clears_and_revokes(client):
    login(client)
    refresh = client.cookies.get("ss_refresh")
    assert client.post("/api/v1/auth/logout").status_code == 200
    with TestClient(app) as other:
        assert other.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code == 401


def test_expired_access_token(client):
    from app.core.config import get_settings

    tok = jwt.encode({"sub": "1", "type": "access", "ver": 0,
                      "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
                     get_settings().secret_key, algorithm="HS256")
    r = client.get("/api/v1/auth/me", headers=bearer(tok))
    assert r.status_code == 401 and r.json()["code"] == "TOKEN_EXPIRED"


def test_refresh_token_not_accepted_as_access(client):
    login(client)
    refresh = client.cookies.get("ss_refresh")
    client.cookies.clear()
    r = client.get("/api/v1/auth/me", headers=bearer(refresh))
    assert r.status_code == 401


def test_csrf_foreign_origin_rejected_for_cookie_auth(admin):
    r = admin.post("/api/v1/admin/faqs", json={"question_uz": "Savol?"},
                   headers={"Origin": "https://evil.example"})
    assert r.status_code == 403 and r.json()["code"] == "CSRF_FAILED"
    r = admin.post("/api/v1/admin/faqs", json={"question_uz": "Savol?"}, headers={"Origin": "http://testserver"})
    assert r.status_code == 201


def _set_last_step(email: str, step):
    with SessionLocal() as db:
        u = db.query(User).filter_by(email=email).one()
        u.totp_last_step = step
        db.commit()


def test_two_factor_flow():
    email, pw = "twofa@smartstart.uz", "TwoFactor2026!"
    with TestClient(app) as c:
        login(c, ADMIN)
        assert c.post("/api/v1/admin/users", json={"email": email, "full_name": "2FA Test", "password": pw,
                                                  "role": "manager"}).status_code == 201
    with TestClient(app) as c:
        login(c, (email, pw))
        setup = c.post("/api/v1/auth/2fa/setup").json()
        assert setup["qr_svg"].lstrip().startswith("<svg") and setup["otpauth_url"].startswith("otpauth://")
        totp = pyotp.TOTP(setup["secret"])
        assert c.post("/api/v1/auth/2fa/enable", json={"otp": "000000"}).json()["code"] == "INVALID_OTP"
        r = c.post("/api/v1/auth/2fa/enable", json={"otp": totp.now()})
        assert r.status_code == 200 and r.json()["two_fa_enabled"] is True

    with TestClient(app) as c:
        r = c.post("/api/v1/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 401 and r.json()["code"] == "OTP_REQUIRED" and r.json()["requires_2fa"] is True
        # same code again in the same window is a replay -> rejected
        r = c.post("/api/v1/auth/login", json={"email": email, "password": pw, "otp": totp.now()})
        assert r.status_code == 401 and r.json()["code"] == "INVALID_OTP"
        _set_last_step(email, None)
        r = c.post("/api/v1/auth/login", json={"email": email, "password": pw, "otp": totp.now()})
        assert r.status_code == 200
        _set_last_step(email, None)
        r = c.post("/api/v1/auth/2fa/disable", json={"otp": totp.at(time.time())})
        assert r.status_code == 200 and r.json()["two_fa_enabled"] is False


def test_change_password_revokes_old_tokens():
    email, pw = "pwchange@smartstart.uz", "OldPassw0rd!"
    with TestClient(app) as c:
        login(c, ADMIN)
        c.post("/api/v1/admin/users", json={"email": email, "full_name": "Pw Test", "password": pw, "role": "manager"})
    with TestClient(app) as c:
        old = login(c, (email, pw))["access_token"]
        assert c.post("/api/v1/auth/change-password",
                      json={"current_password": "wrong", "new_password": "NewPassw0rd!"}).status_code == 400
        r = c.post("/api/v1/auth/change-password", json={"current_password": pw, "new_password": "NewPassw0rd!"})
        assert r.status_code == 200
        assert c.get("/api/v1/auth/me").status_code == 200  # new cookies keep this browser signed in
        assert c.get("/api/v1/auth/me", headers=bearer(old)).json()["code"] == "TOKEN_REVOKED"
    with TestClient(app) as c:
        login(c, (email, "NewPassw0rd!"))


def test_user_management_guards(admin):
    me = admin.get("/api/v1/auth/me").json()
    assert admin.delete(f"/api/v1/admin/users/{me['id']}").json()["code"] == "CANNOT_DELETE_SELF"
    assert admin.put(f"/api/v1/admin/users/{me['id']}", json={"role": "manager"}).json()["code"] == "CANNOT_DEMOTE_SELF"
    r = admin.post("/api/v1/admin/users", json={"email": ADMIN[0], "full_name": "Dup", "password": "Abcdefg123"})
    assert r.status_code == 409
    r = admin.post("/api/v1/admin/users", json={"email": "weak@smartstart.uz", "full_name": "Weak", "password": "12345678"})
    assert r.status_code == 422 and r.json()["code"] == "WEAK_PASSWORD"
