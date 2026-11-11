import pytest

from app.modules.notifications import service as notify


@pytest.fixture(autouse=True)
def _mock_notifications(monkeypatch):
    monkeypatch.setattr(notify, "telegram_send", lambda *a, **k: (True, ""))


def test_public_and_admin_courses(client, admin):
    # 1. Public list should return seeded courses
    courses = client.get("/api/v1/public/courses").json()
    assert isinstance(courses, list)
    assert len(courses) >= 1
    c0 = courses[0]
    assert set(c0) >= {"id", "title", "description", "duration", "is_active"}

    # 2. Admin creates a new course
    create_res = admin.post(
        "/api/v1/admin/courses",
        json={
            "title_uz": "Kiberxavfsizlik asoslari",
            "title_ru": "Основы кибербезопасности",
            "title_en": "Cybersecurity Basics",
            "description_uz": "Zamonaviy axborot xavfsizligi va xavflardan himoyalanish.",
            "duration": "3 oy",
            "price": 750000,
            "price_text": "Oyiga 750 000 so'm",
            "is_active": True,
            "order": 10,
        },
    )
    assert create_res.status_code == 201, create_res.text
    new_c = create_res.json()
    assert new_c["title_uz"] == "Kiberxavfsizlik asoslari"
    cid = new_c["id"]

    # 3. Public get course
    single = client.get(f"/api/v1/public/courses/{cid}").json()
    assert single["title"] == "Kiberxavfsizlik asoslari"
    assert single["price"] == 750000

    # 4. Public enrollment
    enroll_res = client.post(
        f"/api/v1/public/courses/{cid}/enroll",
        json={
            "name": "Ota Test",
            "phone": "+998 90 123 45 67",
            "comment": "Farzandim 9-sinf o'qiydi",
        },
    )
    assert enroll_res.status_code == 201
    assert enroll_res.json()["ok"] is True

    # 5. Admin lists enrollments
    enrs = admin.get("/api/v1/admin/course-enrollments").json()
    assert enrs["total"] >= 1
    first_enr = enrs["items"][0]
    assert first_enr["phone"] == "+998901234567"

    # 6. Admin toggles handled
    togg = admin.patch(f"/api/v1/admin/course-enrollments/{first_enr['id']}/handle").json()
    assert togg["is_handled"] is True

    # 7. Admin toggles course inactive
    admin.put(f"/api/v1/admin/courses/{cid}", json={"is_active": False})
    # Should no longer appear in public courses list
    pub_ids = [c["id"] for c in client.get("/api/v1/public/courses").json()]
    assert cid not in pub_ids

    # 8. Delete course
    del_res = admin.delete(f"/api/v1/admin/courses/{cid}")
    assert del_res.status_code == 204


def test_testimonials_fields_and_crud(client, admin):
    # 1. Public testimonials list
    reviews = client.get("/api/v1/public/testimonials").json()
    assert len(reviews) >= 1
    assert "author" in reviews[0]
    assert "child_name" in reviews[0]

    # 2. Admin adds a new testimonial with child_name and date
    r = admin.post(
        "/api/v1/admin/testimonials",
        json={
            "author": "Shoira Alimova",
            "child_name": "Farzandi: Biloliddin (7-sinf)",
            "text_uz": "Maktabdagi zamonaviy muhit va ustozlarning mehri juda yoqadi.",
            "text_ru": "Очень нравится современная обстановка и забота учителей.",
            "text_en": "We love the modern atmosphere and care of the teachers.",
            "date": "2026-11-01",
            "is_visible": True,
            "order": 5,
        },
    )
    assert r.status_code == 201, r.text
    tid = r.json()["id"]

    # 3. Check admin get
    adm_t = admin.get(f"/api/v1/admin/testimonials/{tid}").json()
    assert adm_t["child_name"] == "Farzandi: Biloliddin (7-sinf)"
    assert adm_t["date"] == "2026-11-01"

    # 4. Check public get
    pub_revs = client.get("/api/v1/public/testimonials").json()
    matching = [x for x in pub_revs if x["id"] == tid]
    assert len(matching) == 1
    assert matching[0]["child_name"] == "Farzandi: Biloliddin (7-sinf)"

    # 5. Admin updates testimonial
    admin.put(f"/api/v1/admin/testimonials/{tid}", json={"is_visible": False})
    pub_after = client.get("/api/v1/public/testimonials").json()
    assert not any(x["id"] == tid for x in pub_after)

    # 6. Admin deletes testimonial
    assert admin.delete(f"/api/v1/admin/testimonials/{tid}").status_code == 204


def test_ish_vaqti_settings(client, admin):
    s = client.get("/api/v1/public/settings").json()
    assert s["phone"] == "+998 98 560 07 20"
    assert "120100" in s["address"]
    assert "08:30–17:30" in s["work_hours_weekday"]
    assert "08:30–12:00" in s["work_hours_saturday"]

    # Admin updates work hours
    up = admin.put(
        "/api/v1/admin/settings",
        json={
            "work_hours_weekday": "Du–Ju: 08:00–18:00",
            "working_hours": "Du–Ju: 08:00–18:00, Sha: 09:00–13:00",
        },
    ).json()
    assert up["work_hours_weekday"] == "Du–Ju: 08:00–18:00"

    # Restore to prompt requirements
    admin.put(
        "/api/v1/admin/settings",
        json={
            "phone": "+998 98 560 07 20",
            "work_hours_weekday": "Du–Ju: 08:30–17:30",
            "work_hours_saturday": "Sha: 08:30–12:00",
            "working_hours": "Du–Ju: 08:30–17:30, Sha: 08:30–12:00",
        },
    )
