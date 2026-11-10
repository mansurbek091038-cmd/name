import json
import re

import pytest

from app.cli import main as cli_main
from app.core.config import get_settings
from app.web import seo

INDEX = """<!doctype html>
<html lang="uz">
  <head>
    <meta charset="UTF-8" />
    <title>Old title</title>
    <meta name="description" content="old" />
  </head>
  <body><div id="root"></div></body>
</html>"""


@pytest.fixture()
def fake_index(tmp_path, monkeypatch):
    f = tmp_path / "index.html"
    f.write_text(INDEX, encoding="utf-8")
    monkeypatch.setattr(seo, "INDEX_FILE", f)
    seo._index_cache.clear()
    yield f
    seo._index_cache.clear()


def _jsonld(html: str) -> list[dict]:
    return [json.loads(m) for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)]


def test_home_seo(client, fake_index):
    r = client.get("/")
    assert r.status_code == 200 and "text/html" in r.headers["content-type"]
    html = r.text
    assert "Old title" not in html and 'content="old"' not in html
    assert html.count("<title>") == 1 and 'name="description"' in html
    assert 'property="og:image"' in html and 'hreflang="ru"' in html and 'hreflang="x-default"' in html
    types = [o["@type"] for o in _jsonld(html)]
    assert "School" in types and "Event" in types
    assert 'id="root"' in html
    assert "content-security-policy" in r.headers


def test_lang_and_routes(client, fake_index):
    html = client.get("/natijalar?lang=ru").text
    assert '<html lang="ru">' in html and "Результаты" in html
    assert client.get("/aloqa?lang=en").text.count('hreflang="en"') == 1
    assert "noindex" in client.get("/admin").text


def test_article_event_jsonld(client, fake_index):
    posts = client.get("/api/v1/public/posts", params={"type": "event"}).json()["items"]
    html = client.get(f"/yangiliklar/{posts[0]['slug']}").text
    assert any(o["@type"] == "Event" and o["startDate"] for o in _jsonld(html))
    assert 'property="og:type" content="article"' in html
    r = client.get("/yangiliklar/does-not-exist")
    assert r.status_code == 404 and "<html" in r.text


def test_placeholder_without_build(client, tmp_path, monkeypatch):
    monkeypatch.setattr(seo, "INDEX_FILE", tmp_path / "missing.html")
    seo._index_cache.clear()
    r = client.get("/")
    assert r.status_code == 200 and "/api/docs" in r.text


def test_sitemap_robots_docs(client):
    sm = client.get("/sitemap.xml")
    assert sm.status_code == 200 and "application/xml" in sm.headers["content-type"]
    assert "/yangiliklar/" in sm.text and 'hreflang="en"' in sm.text
    robots = client.get("/robots.txt").text
    assert "Disallow: /api/" in robots and "Sitemap: https://smartstart.test/sitemap.xml" in robots
    assert client.get("/api/docs").status_code == 200
    spec = client.get("/api/openapi.json").json()
    assert "/api/v1/public/admissions" in spec["paths"]


def test_error_format(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and set(r.json()) == {"code", "message"}
    r = client.post("/api/v1/public/admissions", content="not json", headers={"content-type": "application/json"})
    assert r.status_code == 422 and r.json()["code"] == "VALIDATION_ERROR"
    r = client.get("/api/v1/public/certificates/abc")
    assert r.status_code == 422 and "fields" in r.json()


def test_security_headers(client):
    r = client.get("/api/v1/public/faqs")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["cache-control"].startswith("public")
    assert client.get("/api/v1/health").json()["status"] == "ok"
    assert client.get("/health").json()["status"] == "ok"
    assert client.head("/health").status_code == 200


def test_cors_restricted(client):
    ok = client.options("/api/v1/public/faqs", headers={"Origin": "http://localhost:5173",
                                                        "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    bad = client.options("/api/v1/public/faqs", headers={"Origin": "https://evil.example",
                                                         "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


def test_backup_keeps_last_n(tmp_path):
    for _ in range(3):
        assert cli_main(["backup", "--keep", "2", "--dir", str(tmp_path)]) == 0
    files = sorted(tmp_path.glob("smartstart-db-*"))
    assert 1 <= len(files) <= 2
    assert get_settings().backup_keep == 30
