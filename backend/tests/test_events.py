from datetime import timedelta

import pytest

from app.core.utils import today_local
from app.modules.notifications import service as notify


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    monkeypatch.setattr(notify, "telegram_send", lambda *a, **k: (True, ""))


def _tour(admin, capacity=2, days=5, **extra):
    r = admin.post("/api/v1/admin/tours", json={"date": (today_local() + timedelta(days=days)).isoformat(),
                                                "time": "11:00", "capacity": capacity, "type": "ekskursiya", **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_public_tours_shape(client):
    tours = client.get("/api/v1/public/tours").json()
    assert tours, "seed should create upcoming tours"
    for t in tours:
        assert set(t) >= {"id", "date", "time", "type", "capacity", "booked", "free"}
        assert t["free"] == max(0, t["capacity"] - t["booked"])
        assert t["type"] in ("ekskursiya", "ochiq_eshiklar")
    assert any(t["free"] == 0 for t in tours)  # seed has one full tour


def test_capacity_enforced(client, admin):
    t = _tour(admin, capacity=2)
    url = f"/api/v1/public/tours/{t['id']}/book"
    r1 = client.post(url, json={"parent_name": "Bir", "phone": "+998901000001", "children_count": 2})
    assert r1.status_code == 201 and r1.json()["tour"]["free"] == 1
    dup = client.post(url, json={"parent_name": "Bir", "phone": "901000001"})
    assert dup.status_code == 409 and dup.json()["code"] == "ALREADY_BOOKED"
    assert client.post(url, json={"parent_name": "Ikki", "phone": "+998901000002"}).status_code == 201
    full = client.post(url, json={"parent_name": "Uch", "phone": "+998901000003"})
    assert full.status_code == 409 and full.json()["code"] == "TOUR_FULL"
    listed = {x["id"]: x for x in client.get("/api/v1/public/tours").json()}
    assert listed[t["id"]]["booked"] == 2 and listed[t["id"]]["free"] == 0
    # admin cannot shrink capacity below bookings
    r = admin.put(f"/api/v1/admin/tours/{t['id']}", json={"capacity": 1})
    assert r.status_code == 409 and r.json()["code"] == "CAPACITY_BELOW_BOOKED"
    bookings = admin.get(f"/api/v1/admin/tours/{t['id']}/bookings").json()
    assert bookings["total"] == 2
    # cancelling one frees a place
    bid = bookings["items"][0]["id"]
    assert admin.delete(f"/api/v1/admin/tours/{t['id']}/bookings/{bid}").status_code == 204
    assert client.post(url, json={"parent_name": "Uch", "phone": "+998901000003"}).status_code == 201


def test_closed_and_inactive_tours(client, admin):
    past = _tour(admin, days=-1)
    r = client.post(f"/api/v1/public/tours/{past['id']}/book", json={"parent_name": "Ota", "phone": "+998901000009"})
    assert r.status_code == 409 and r.json()["code"] == "TOUR_CLOSED"
    hidden = _tour(admin, is_active=False)
    assert hidden["id"] not in [t["id"] for t in client.get("/api/v1/public/tours").json()]
    assert client.post("/api/v1/public/tours/99999/book",
                       json={"parent_name": "Ota", "phone": "+998901000009"}).status_code == 404


def test_booking_rate_limit(client, admin):
    t = _tour(admin, capacity=50)
    codes = [client.post(f"/api/v1/public/tours/{t['id']}/book",
                         json={"parent_name": "Ota", "phone": f"+9989010001{i:02d}"}).status_code for i in range(11)]
    assert codes[:10] == [201] * 10 and codes[10] == 429
