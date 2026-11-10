import re

import pytest

from app.modules.notifications import service as notify

VALID = {"parent_name": "Test Ota-ona", "phone": "+998 90 123 45 67", "child_name": "Test Bola",
         "target_grade": 5, "birth_year": 2016, "comment": "<b>salom</b> & xayr", "utm_source": "Instagram",
         "utm_campaign": "kuz"}


@pytest.fixture()
def sent(monkeypatch):
    """Capture Telegram/SMS calls instead of hitting the network."""
    calls = {"telegram": [], "sms": []}
    monkeypatch.setattr(notify, "telegram_send",
                        lambda token, chats, text, markup=None: calls["telegram"].append(text) or (True, ""))
    monkeypatch.setattr(notify, "send_sms", lambda phone, msg: calls["sms"].append((phone, msg)) or (True, ""))
    return calls


def test_submit_admission(client, sent, admin):
    admin.put("/api/v1/admin/settings", json={"telegram_bot_token": "123:abc", "telegram_chat_id": "-100",
                                              "telegram_enabled": True, "sms_enabled": True,
                                              "eskiz_email": "a@b.uz", "eskiz_password": "x"})
    r = client.post("/api/v1/public/admissions", json=VALID)
    assert r.status_code == 201, r.text
    body = r.json()
    assert re.fullmatch(r"SS-\d{4}-\d{5}", body["number"]) and body["message"]
    detail = admin.get(f"/api/v1/admin/admissions/{body['id']}").json()
    assert detail["phone"] == "+998901234567" and detail["status"] == "new"
    assert detail["utm_source"] == "instagram"
    # background tasks ran after the response
    assert sent["telegram"] and "YANGI QABUL ARIZASI" in sent["telegram"][-1]
    assert "&lt;b&gt;salom&lt;/b&gt;" in sent["telegram"][-1]  # user text is HTML-escaped
    assert sent["sms"] and sent["sms"][-1][0] == "+998901234567"
    admin.put("/api/v1/admin/settings", json={"telegram_bot_token": "", "telegram_chat_id": "", "sms_enabled": False})


@pytest.mark.parametrize("phone", ["12345", "+7 999 123 45 67", "+99890123456", "abc"])
def test_invalid_phone(client, phone):
    r = client.post("/api/v1/public/admissions", json={**VALID, "phone": phone})
    assert r.status_code == 422
    assert r.json()["code"] == "VALIDATION_ERROR" and "phone" in r.json()["fields"]


@pytest.mark.parametrize("phone", ["901234567", "998901234567", "+998 (90) 123-45-67"])
def test_phone_normalised(client, phone, sent):
    r = client.post("/api/v1/public/admissions", json={**VALID, "phone": phone})
    assert r.status_code == 201


def test_rate_limit_5_per_hour(client, sent):
    codes = [client.post("/api/v1/public/admissions", json=VALID).status_code for _ in range(6)]
    assert codes[:5] == [201] * 5
    assert codes[5] == 429
    r = client.post("/api/v1/public/admissions", json=VALID)
    assert r.json()["code"] == "RATE_LIMITED" and "retry-after" in r.headers


def test_turnstile_enforced_when_configured(client, admin, sent, monkeypatch):
    admin.put("/api/v1/admin/settings", json={"turnstile_secret": "sekret"})
    r = client.post("/api/v1/public/admissions", json=VALID)
    assert r.status_code == 400 and r.json()["code"] == "CAPTCHA_REQUIRED"

    class Resp:
        def __init__(self, ok):
            self.ok = ok

        def json(self):
            return {"success": self.ok}

    monkeypatch.setattr(notify.httpx, "post", lambda *a, **k: Resp(False))
    r = client.post("/api/v1/public/admissions", json={**VALID, "turnstile_token": "bad"})
    assert r.status_code == 400 and r.json()["code"] == "CAPTCHA_FAILED"
    monkeypatch.setattr(notify.httpx, "post", lambda *a, **k: Resp(True))
    assert client.post("/api/v1/public/admissions", json={**VALID, "turnstile_token": "ok"}).status_code == 201
    admin.put("/api/v1/admin/settings", json={"turnstile_secret": ""})
    assert admin.get("/api/v1/admin/settings").json()["turnstile_secret_set"] is False


def test_contact_form(client, sent):
    r = client.post("/api/v1/public/contact", json={"name": "Test", "phone": "901234567", "message": "Savol bor"})
    assert r.status_code == 201


def test_crm_flow(admin, sent):
    r = admin.get("/api/v1/admin/admissions", params={"page_size": 5})
    data = r.json()
    assert data["total"] >= 40 and len(data["items"]) == 5 and data["pages"] >= 8
    item = data["items"][0]
    for key in ("id", "number", "parent_name", "phone", "child_name", "birth_year", "target_grade", "comment",
                "status", "assigned_to", "next_call_at", "utm_source", "utm_campaign", "created_at", "notes_count"):
        assert key in item
    staff = admin.get("/api/v1/admin/staff").json()
    a_id = item["id"]
    r = admin.patch(f"/api/v1/admin/admissions/{a_id}",
                    json={"status": "interview", "assigned_to": staff[0]["id"], "next_call_at": "2026-12-01T10:00:00"})
    assert r.status_code == 200
    d = r.json()
    assert d["status"] == "interview" and d["assigned_to"]["id"] == staff[0]["id"]
    assert d["next_call_at"].endswith("+05:00")
    assert d["history"][-1]["details"]["changes"]["status"]["to"] == "interview"
    assert admin.patch(f"/api/v1/admin/admissions/{a_id}", json={"status": "bogus"}).status_code == 422
    n = admin.post(f"/api/v1/admin/admissions/{a_id}/notes", json={"text": "Suhbatga keladi"})
    assert n.status_code == 201 and n.json()["author"]["full_name"]
    d = admin.get(f"/api/v1/admin/admissions/{a_id}").json()
    assert d["notes"][-1]["text"] == "Suhbatga keladi" and d["notes_count"] == len(d["notes"])
    # filters
    assert all(i["status"] == "interview" for i in
               admin.get("/api/v1/admin/admissions", params={"status": "interview"}).json()["items"])
    direct = admin.get("/api/v1/admin/admissions", params={"source": "direct"}).json()["items"]
    assert all(i["utm_source"] is None for i in direct)
    found = admin.get("/api/v1/admin/admissions", params={"search": d["number"]}).json()
    assert found["total"] == 1


def test_delete_admission_admin_only(admin, manager_client):
    a_id = admin.get("/api/v1/admin/admissions", params={"page_size": 1}).json()["items"][0]["id"]
    assert manager_client.delete(f"/api/v1/admin/admissions/{a_id}").status_code == 403
    assert admin.delete(f"/api/v1/admin/admissions/{a_id}").status_code == 204
    assert admin.get(f"/api/v1/admin/admissions/{a_id}").status_code == 404
