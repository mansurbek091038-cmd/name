from app.core.db import SessionLocal
from app.modules.content.models import Certificate
from app.modules.content.service import mask_cert_number

CERT_KEYS = {"id", "type", "score", "sub_scores", "student_name", "grade", "year", "date", "subject", "level",
             "teacher", "cert_number_masked", "image", "verify_url", "is_featured", "is_new"}


def _consent_split():
    with SessionLocal() as db:
        rows = db.query(Certificate).all()
        return [c.id for c in rows if c.parent_consent], [c.id for c in rows if not c.parent_consent]


def test_certificates_consent_filter(client):
    yes, no = _consent_split()
    assert no, "seed must contain certificates without consent"
    data = client.get("/api/v1/public/certificates", params={"page_size": 100}).json()
    ids = {c["id"] for c in data["items"]}
    assert ids == set(yes) and not ids & set(no)
    assert data["total"] == len(yes)
    for cid in no:
        assert client.get(f"/api/v1/public/certificates/{cid}").status_code == 404
    stats = client.get("/api/v1/public/certificates/stats").json()
    assert stats["total"] == len(yes)
    assert set(stats) == {"ielts_7_plus", "cefr_b2_c1", "olympiad_winners", "sat_1300_plus", "total"}


def test_certificate_shape_and_privacy(client):
    item = client.get("/api/v1/public/certificates", params={"page_size": 1}).json()["items"][0]
    assert set(item) == CERT_KEYS
    assert "cert_number" not in item and "•" in item["cert_number_masked"]
    assert item["image"]["url"].startswith("/media/public/")
    for size in ("thumb", "medium", "large"):
        assert item["image"][size].startswith("/media/public/")


def test_certificate_filters_and_sort(client):
    ielts = client.get("/api/v1/public/certificates", params={"type": "IELTS", "page_size": 50}).json()["items"]
    assert ielts and all(c["type"] == "IELTS" for c in ielts)
    olymp = client.get("/api/v1/public/certificates", params={"type": "Olimpiada"}).json()["items"]
    assert all(c["type"] == "olimpiada" for c in olymp)
    y = client.get("/api/v1/public/certificates", params={"year": 2024, "page_size": 50}).json()["items"]
    assert y and all(c["year"] == 2024 for c in y)
    names = [c["student_name"] for c in
             client.get("/api/v1/public/certificates", params={"sort": "name", "page_size": 50}).json()["items"]]
    assert names == sorted(names)
    feat = client.get("/api/v1/public/certificates", params={"featured": True, "page_size": 50}).json()["items"]
    assert all(c["is_featured"] for c in feat)
    s = client.get("/api/v1/public/certificates", params={"search": "aziza"}).json()
    assert s["total"] >= 1


def test_mask():
    assert mask_cert_number("24BBA1141177AM") == "24B•••••••••AM"
    assert mask_cert_number("") == ""
    assert "•" in mask_cert_number("ABCDEF")


def test_admin_certificate_private_original(admin):
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (800, 600), (200, 180, 120)).save(buf, "PNG")
    up = admin.post("/api/v1/admin/media", files={"file": ("c.png", buf.getvalue(), "image/png")},
                    data={"private": "true"}).json()
    assert up["is_private"] and up["url"].startswith("/api/v1/admin/media/")
    r = admin.post("/api/v1/admin/certificates", json={
        "type": "IELTS", "score": "7.5", "student_name": "Test O'quvchi", "grade": 11, "date": "2026-05-01",
        "cert_number": "IELTS-TEST-0001", "image_id": up["id"], "parent_consent": True,
        "redact_regions": [{"x": 0.1, "y": 0.1, "w": 0.3, "h": 0.1}], "sub_scores": {"listening": 8}})
    assert r.status_code == 201, r.text
    cert = r.json()
    assert cert["original_image_id"] == up["id"] and cert["image"]["id"] != up["id"]
    assert cert["year"] == 2026 and cert["sub_scores"] == {"listening": "8"}
    pub = admin.get(f"/api/v1/public/certificates/{cert['id']}").json()
    assert pub["image"]["url"].startswith("/media/public/")
    # consent file must be private
    pubmedia = admin.post("/api/v1/admin/media", files={"file": ("p.png", buf.getvalue(), "image/png")}).json()
    bad = admin.put(f"/api/v1/admin/certificates/{cert['id']}", json={"consent_file_id": pubmedia["id"]})
    assert bad.status_code == 422
    # withdrawing consent hides it immediately
    admin.put(f"/api/v1/admin/certificates/{cert['id']}", json={"parent_consent": False})
    assert admin.get(f"/api/v1/public/certificates/{cert['id']}").status_code == 404
    assert admin.delete(f"/api/v1/admin/certificates/{cert['id']}").status_code == 204


def test_public_content_localized(client):
    home_ru = client.get("/api/v1/public/pages/home", params={"lang": "ru"}).json()
    hero = home_ru["blocks"]["hero"]
    assert hero["title_accent"] == "сегодня" and hero["image"]["url"].startswith("/media/public/")
    assert home_ru["blocks"]["stats"][0]["value"] == 300  # falls back to uz for empty fields
    assert len(home_ru["blocks"]["stages"]) == 3 and home_ru["blocks"]["stages"][0]["image"]["thumb"]
    assert home_ru["seo"]["title"]
    for key in ("about", "admission", "contact", "privacy", "thanks"):
        assert client.get(f"/api/v1/public/pages/{key}").status_code == 200
    assert client.get("/api/v1/public/pages/missing").json()["code"] == "NOT_FOUND"
    teachers = client.get("/api/v1/public/teachers", params={"lang": "en"}).json()
    assert len(teachers) >= 4 and teachers[0]["badge"] and teachers[0]["photo"]["thumb"]
    partners = client.get("/api/v1/public/partners").json()
    assert len(partners) == 6 and all(p["lat"] is not None for p in partners)
    prices = client.get("/api/v1/public/prices").json()
    assert all(isinstance(p["monthly_fee"], int) for p in prices)
    assert len(client.get("/api/v1/public/faqs").json()) >= 5
    assert len(client.get("/api/v1/public/testimonials").json()) == 3
    posts = client.get("/api/v1/public/posts").json()
    assert posts["total"] >= 4 and set(posts["items"][0]) >= {"id", "type", "slug", "title", "excerpt", "cover",
                                                               "event_date", "published_at"}
    post = client.get(f"/api/v1/public/posts/{posts['items'][0]['slug']}").json()
    assert post["body"] and post["seo"]["title"]
    albums = client.get("/api/v1/public/albums").json()
    assert len(albums) == 2 and albums[0]["count"] >= 1
    assert client.get(f"/api/v1/public/albums/{albums[0]['id']}").json()["items"]
    s = client.get("/api/v1/public/settings").json()
    assert set(s) == {"site_name", "phone", "telegram", "instagram", "address", "turnstile_site_key", "ga4_id",
                      "ym_id", "meta_pixel_id"}


def test_post_html_sanitized_and_draft_hidden(admin, client):
    r = admin.post("/api/v1/admin/posts", json={
        "title_uz": "Xavfsiz maqola", "body_uz": '<p onclick="x()">Hi<script>alert(1)</script>'
                                                  '<img src="javascript:alert(1)"></p>'})
    p = r.json()
    assert "script" not in p["body_uz"] and "onclick" not in p["body_uz"] and "javascript" not in p["body_uz"]
    assert p["status"] == "draft"
    assert client.get(f"/api/v1/public/posts/{p['slug']}").status_code == 404
    admin.put(f"/api/v1/admin/posts/{p['id']}", json={"published_at": "2026-01-01T09:00:00"})
    assert client.get(f"/api/v1/public/posts/{p['slug']}").status_code == 200
    dup = admin.post("/api/v1/admin/posts", json={"title_uz": "Xavfsiz maqola"}).json()
    assert dup["slug"] != p["slug"]


def test_page_update_and_audit(admin):
    page = admin.get("/api/v1/admin/pages/thanks").json()
    blocks = page["blocks_uz"]
    blocks["title"] = "Katta rahmat!"
    r = admin.put("/api/v1/admin/pages/thanks", json={"blocks_uz": blocks})
    assert r.status_code == 200 and r.json()["blocks_uz"]["title"] == "Katta rahmat!"
    log = admin.get("/api/v1/admin/audit-log", params={"entity": "page"}).json()
    assert log["items"] and log["items"][0]["entity"] == "page"
