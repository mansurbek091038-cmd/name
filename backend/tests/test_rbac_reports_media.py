import io
import re

from openpyxl import load_workbook
from PIL import Image

from app.core.config import get_settings
from app.main import app

ADMIN_ONLY = ["/api/v1/admin/reports/dashboard", "/api/v1/admin/admissions/export", "/api/v1/admin/settings",
              "/api/v1/admin/audit-log"]
MANAGER_OK = ["/api/v1/admin/admissions", "/api/v1/admin/posts", "/api/v1/admin/teachers", "/api/v1/admin/prices",
              "/api/v1/admin/faqs", "/api/v1/admin/testimonials", "/api/v1/admin/certificates",
              "/api/v1/admin/partners", "/api/v1/admin/albums", "/api/v1/admin/tours", "/api/v1/admin/media",
              "/api/v1/admin/pages", "/api/v1/admin/staff"]


def test_every_admin_route_requires_auth(client):
    spec = client.get("/api/openapi.json").json()
    checked = 0
    for raw_path, ops in spec["paths"].items():
        if not raw_path.startswith("/api/v1/admin"):
            continue
        path = re.sub(r"\{[^}]+\}", "1", raw_path)
        for method in ops:
            r = client.request(method.upper(), path, json={})
            assert r.status_code == 401, f"{method} {raw_path} -> {r.status_code}"
            assert r.json()["code"] == "UNAUTHORIZED"
            checked += 1
    assert checked > 60


def test_role_matrix(manager_client, admin):
    for path in ADMIN_ONLY:
        assert manager_client.get(path).status_code == 403, path
        assert admin.get(path).status_code == 200, path
    for path in MANAGER_OK:
        assert manager_client.get(path).status_code == 200, path
    assert manager_client.get("/api/v1/admin/users").status_code == 403
    assert admin.get("/api/v1/admin/users").status_code == 200  # super_admin


def test_admin_role_cannot_manage_users(admin):
    admin.post("/api/v1/admin/users", json={"email": "plainadmin@smartstart.uz", "full_name": "Admin",
                                            "password": "PlainAdmin1", "role": "admin"})
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        c.post("/api/v1/auth/login", json={"email": "plainadmin@smartstart.uz", "password": "PlainAdmin1"})
        assert c.get("/api/v1/admin/reports/dashboard").status_code == 200
        assert c.get("/api/v1/admin/users").status_code == 403


def test_dashboard(admin):
    d = admin.get("/api/v1/admin/reports/dashboard").json()
    assert set(d["totals"]) == {"admissions", "new_today", "this_month", "conversion_rate", "tours_upcoming",
                                "bookings_upcoming"}
    assert len(d["by_day"]) == 30 and d["by_day"][-1]["count"] >= 1
    assert [s["status"] for s in d["by_status"]] == ["new", "contacted", "tour_scheduled", "interview", "contract",
                                                     "rejected"]
    assert sum(s["count"] for s in d["by_status"]) == d["totals"]["admissions"]
    assert d["by_source"] and d["by_grade"] and len(d["recent"]) == 5


def test_export_xlsx(admin):
    r = admin.get("/api/v1/admin/admissions/export", params={"status": "new"})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/vnd.openxmlformats")
    assert "attachment" in r.headers["content-disposition"]
    wb = load_workbook(io.BytesIO(r.content))
    ws = wb["Arizalar"]
    assert ws["B1"].value == "Ariza raqami"
    new_total = admin.get("/api/v1/admin/admissions", params={"status": "new"}).json()["total"]
    assert ws.max_row - 1 == new_total
    assert all(ws.cell(row=i, column=9).value == "Yangi" for i in range(2, ws.max_row + 1))
    assert "Xulosa" in wb.sheetnames
    log = admin.get("/api/v1/admin/audit-log", params={"action": "export"}).json()
    assert log["total"] >= 1


def _png(w, h):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (10, 120, 200)).save(buf, "PNG")
    return buf.getvalue()


def test_media_upload_variants(admin, client):
    r = admin.post("/api/v1/admin/media", files={"file": ("big.png", _png(3000, 1500), "image/png")},
                   data={"alt_uz": "Sinov", "album_id": "1"})
    assert r.status_code == 201, r.text
    m = r.json()
    root = get_settings().media_root
    for size, maxw in (("thumb", 400), ("medium", 960), ("large", 1920)):
        path = root / m[size].removeprefix("/media/")
        assert path.exists()
        with Image.open(path) as im:
            assert im.format == "WEBP" and im.width == maxw
    assert m["width"] == 2560  # full copy is capped at 2560 px
    assert client.get(m["thumb"]).status_code == 200
    assert client.get(m["thumb"]).headers["content-type"] == "image/webp"
    # original is kept privately and never served statically
    original = admin.get(m["original_url"])
    assert original.status_code == 200 and original.headers["content-type"] == "image/png"
    assert client.get(m["original_url"]).status_code in (200, 401)
    with __import__("fastapi.testclient", fromlist=["TestClient"]).TestClient(app) as anon:
        assert anon.get(m["original_url"]).status_code == 401
        assert anon.get("/media/private/originals/whatever.png").status_code == 404
    assert admin.delete(f"/api/v1/admin/media/{m['id']}").status_code == 204
    assert not (root / m["thumb"].removeprefix("/media/")).exists()


def test_media_rejects_non_images(admin):
    r = admin.post("/api/v1/admin/media", files={"file": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 415 and r.json()["code"] == "UNSUPPORTED_MEDIA_TYPE"
    pdf = b"%PDF-1.4\n%test\n"
    assert admin.post("/api/v1/admin/media", files={"file": ("c.pdf", pdf, "application/pdf")}).status_code == 415
    r = admin.post("/api/v1/admin/media", files={"file": ("c.pdf", pdf, "application/pdf")}, data={"private": "1"})
    assert r.status_code == 201 and r.json()["is_private"] and r.json()["thumb"] is None
