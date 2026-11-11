"""Seed the database with the real Smart Start content + demo CRM data.

    python -m app.cli seed            # only if the database is empty
    python -m app.cli seed --reset    # wipe database AND media, then seed again
"""
from __future__ import annotations

import io
import json
import logging
import random
import re
import shutil
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import SEED_ASSETS_DIR, get_settings
from app.core.db import Base, SessionLocal, engine, init_db
from app.core.security import hash_password
from app.core.utils import TASHKENT, now_local, today_local
from app.modules.admissions.models import Admission, AdmissionNote, ContactMessage
from app.modules.auth.models import AuditLog, User
from app.modules.content.models import (
    Certificate,
    Faq,
    Page,
    Partner,
    Post,
    Price,
    Teacher,
    Testimonial,
)
from app.modules.content.service import score_value
from app.modules.courses.models import Course
from app.modules.events.models import Tour, TourBooking
from app.modules.media.models import Album, Media
from app.modules.media.pipeline import create_media, derive_public_copy
from app.modules.notifications.models import SiteSetting
from seed import content as C

log = logging.getLogger("smartstart.seed")

NAVY = (19, 41, 75)
GOLD = (207, 158, 46)
CREAM = (251, 246, 234)

DEMO_USERS = [
    ("admin@smartstart.uz", "SmartStart2026!", "super_admin", "Bosh administrator"),
    ("manager@smartstart.uz", "Manager2026!", "manager", "Qabul menejeri (demo)"),
]

PHOTOS = {
    # name: (file, alt uz, alt ru, alt en, album)
    "school_entrance": ("school_entrance.jpg", "Smart Start maktab binosi", "Здание школы Smart Start",
                        "Smart Start school building", 1),
    "school_entrance_family": ("school_entrance_family.jpg", "Ota-onalar va bolalar maktab kirishida",
                               "Родители и дети у входа в школу", "Families arriving at the school entrance", 1),
    "classroom": ("classroom.jpg", "Smart Start sinfxonasida dars", "Урок в классе Smart Start",
                  "A lesson in a Smart Start classroom", 2),
    "stage_primary": ("stage_primary.jpg", "Boshlang'ich sinf o'quvchilari", "Ученики начальной школы",
                      "Primary school students", 2),
    "stage_middle": ("stage_middle.jpg", "O'rta sinflar: robototexnika mashg'uloti", "Средняя школа: робототехника",
                     "Middle school: robotics class", 2),
    "stage_high": ("stage_high.jpg", "Yuqori sinf o'quvchilari darsda", "Старшеклассники на уроке",
                   "High school students in class", 2),
    "logo": ("logo.png", "Smart Start logotipi", "Логотип Smart Start", "Smart Start logo", None),
}
ALBUMS = [
    ("Maktab binosi", "Здание школы", "School building"),
    ("Darslar va sinflar", "Уроки и классы", "Lessons and classrooms"),
]


# ---------------- generated placeholder images ----------------
def _font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "/Library/Fonts/Arial Bold.ttf" if bold else "/Library/Fonts/Arial.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            return ImageFont.truetype(c, size)
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow
        return ImageFont.load_default()


def _center(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, font, fill) -> None:
    draw.text(xy, text, font=font, fill=fill, anchor="mm")


def _png(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def avatar_png(name: str) -> bytes:
    """Neutral portrait placeholder (soft silhouette) until the school uploads real teacher photos."""
    w = h = 800
    img = Image.new("RGB", (w, h), (243, 237, 224))
    d = ImageDraw.Draw(img)
    for y in range(h):  # warm vertical gradient
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(246 - 18 * t), int(241 - 22 * t), int(230 - 30 * t)))
    sil = (205, 192, 166)
    d.ellipse((290, 210, 510, 450), fill=sil)              # head
    d.rounded_rectangle((170, 480, 630, 900), radius=200, fill=sil)  # shoulders
    return _png(img)


def partner_logo_png(code: str) -> bytes:
    img = Image.new("RGB", (600, 600), (255, 255, 255))
    d = ImageDraw.Draw(img)
    d.ellipse((40, 40, 560, 560), fill=NAVY)
    size = 200 if len(code) <= 2 else (150 if len(code) <= 3 else 110)
    _center(d, (300, 300), code, _font(size), GOLD)
    return _png(img)


def result_card_png(c: dict) -> bytes:
    """A clearly-labelled summary card (NOT an imitation of the official certificate)."""
    w, h = 1200, 850
    img = Image.new("RGB", (w, h), CREAM)
    d = ImageDraw.Draw(img)
    d.rectangle((24, 24, w - 24, h - 24), outline=NAVY, width=6)
    d.rectangle((40, 40, w - 40, h - 40), outline=GOLD, width=2)
    _center(d, (w // 2, 110), "SMART START", _font(54), NAVY)
    _center(d, (w // 2, 165), "NATIJA KARTASI · RESULT CARD", _font(26, bold=False), GOLD)
    ctype = "OLIMPIADA" if c["type"] == "olimpiada" else c["type"]
    _center(d, (w // 2, 260), ctype, _font(44), NAVY)
    score = c["score"] if c["type"] != "olimpiada" else f"{c['score']}-o'rin"
    _center(d, (w // 2, 375), score, _font(130), GOLD)
    if c.get("subject"):
        _center(d, (w // 2, 465), f"{c['subject']} · {c.get('level') or ''}".strip(" ·"), _font(32, bold=False), NAVY)
    _center(d, (w // 2, 540), c["name"].title(), _font(52), NAVY)
    _center(d, (w // 2, 600), f"{c['grade']}-sinf · {c.get('date') or c['year']}", _font(30, bold=False), NAVY)
    subs = c.get("subScores") or {}
    if subs:
        label = {"listening": "L", "reading": "R", "writing": "W", "speaking": "S", "math": "Math", "ebrw": "EBRW"}
        line = "   ".join(f"{label.get(k, k)}: {v}" for k, v in subs.items())
        _center(d, (w // 2, 665), line, _font(30, bold=False), NAVY)
    _center(d, (w // 2, 770), "Asl sertifikat nusxasi maktab ma'muriyatida saqlanadi", _font(22, bold=False),
            (110, 110, 110))
    return _png(img)


# ---------------- helpers ----------------
UZ_MONTHS = {"yanvar": 1, "fevral": 2, "mart": 3, "aprel": 4, "may": 5, "iyun": 6, "iyul": 7, "avgust": 8,
             "sentyabr": 9, "oktyabr": 10, "noyabr": 11, "dekabr": 12}


def parse_cert_date(s: str | None, year: int | None) -> date | None:
    if not s:
        return date(year, 1, 1) if year else None
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", s)
    if m:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    m = re.match(r"([A-Za-z']+),?\s*(\d{4})", s)
    if m and m.group(1).lower() in UZ_MONTHS:
        return date(int(m.group(2)), UZ_MONTHS[m.group(1).lower()], 1)
    return date(year, 1, 1) if year else None


def _replace_refs(value: Any, refs: dict[str, int]) -> Any:
    if isinstance(value, dict):
        return {k: _replace_refs(v, refs) for k, v in value.items()}
    if isinstance(value, list):
        return [_replace_refs(v, refs) for v in value]
    if isinstance(value, str) and value.startswith("@"):
        return refs.get(value[1:])
    return value


def _dt(s: str) -> datetime:
    return datetime.fromisoformat(s)


def wipe_media() -> None:
    root = get_settings().media_root
    for sub in ("public", "private"):
        p = root / sub
        if p.exists():
            shutil.rmtree(p)
        p.mkdir(parents=True, exist_ok=True)
        (p / ".gitkeep").touch()
    (root / "private" / "originals").mkdir(parents=True, exist_ok=True)


# ---------------- seeding steps ----------------
def seed_users(db: Session) -> dict[str, User]:
    users = {}
    for email, pw, role, name in DEMO_USERS:
        u = User(email=email, password_hash=hash_password(pw), role=role, full_name=name, is_active=True)
        db.add(u)
        users[role] = u
    db.flush()
    return users


def seed_media(db: Session, admin: User) -> dict[str, int]:
    albums = []
    for i, (uz, ru, en) in enumerate(ALBUMS):
        a = Album(title_uz=uz, title_ru=ru, title_en=en, order=i, is_visible=True)
        db.add(a)
        albums.append(a)
    db.flush()
    refs: dict[str, int] = {}
    order = {1: 0, 2: 0}
    for key, (fname, uz, ru, en, album) in PHOTOS.items():
        data = (SEED_ASSETS_DIR / fname).read_bytes()
        album_id = albums[album - 1].id if album else None
        if album:
            order[album] += 1
        m = create_media(db, data, fname, alt_uz=uz, alt_ru=ru, alt_en=en, album_id=album_id,
                         order=order.get(album, 0), uploaded_by=admin.id)
        refs[key] = m.id
    albums[0].cover_id = refs["school_entrance"]
    albums[1].cover_id = refs["classroom"]
    return refs


def seed_pages(db: Session, refs: dict[str, int]) -> None:
    for key, (blocks, seo, og) in C.PAGES.items():
        p = Page(key=key,
                 blocks_uz=_replace_refs(blocks["uz"], refs), blocks_ru=_replace_refs(blocks["ru"], refs),
                 blocks_en=_replace_refs(blocks["en"], refs),
                 og_image_id=refs.get(og[1:]) if og else None)
        for lang in ("uz", "ru", "en"):
            setattr(p, f"seo_title_{lang}", seo[lang][0])
            setattr(p, f"seo_description_{lang}", seo[lang][1])
        db.add(p)


def seed_teachers(db: Session) -> None:
    for i, t in enumerate(C.TEACHERS):
        photo = create_media(db, avatar_png(t["full_name"]), f"teacher-{i + 1}.png",
                             alt_uz=t["full_name"], alt_ru=t["full_name"], alt_en=t["full_name"])
        row = Teacher(full_name=t["full_name"], experience_years=t["experience_years"], photo_id=photo.id,
                      order=i, is_visible=True)
        for j, lang in enumerate(("uz", "ru", "en")):
            for f in ("subject", "badge", "bio"):
                setattr(row, f"{f}_{lang}", t[f][j])
        db.add(row)


def seed_partners(db: Session) -> None:
    for i, p in enumerate(C.PARTNERS):
        logo = create_media(db, partner_logo_png(p["code"]), f"partner-{p['code'].lower()}.png",
                            alt_uz=p["name"], alt_ru=p["name"], alt_en=p["name"])
        row = Partner(name=p["name"], country_code=p["country_code"], logo_id=logo.id, qs_rank=p["qs_rank"],
                      qs_year=2025, website_url=p["website_url"], lat=p["lat"], lng=p["lng"], order=i)
        for j, lang in enumerate(("uz", "ru", "en")):
            setattr(row, f"country_{lang}", p["country"][j])
            setattr(row, f"description_{lang}", C.PARTNER_DESCRIPTION[j])
        db.add(row)


def seed_simple(db: Session) -> None:
    for i, p in enumerate(C.PRICES):
        db.add(Price(grade_range=p["grade_range"], monthly_fee=p["monthly_fee"], meals_fee=p["meals_fee"],
                     transport_fee=p["transport_fee"], note_uz=p["note"][0], note_ru=p["note"][1],
                     note_en=p["note"][2], order=i))
    for i, (q, a) in enumerate(C.FAQS):
        db.add(Faq(question_uz=q[0], question_ru=q[1], question_en=q[2], answer_uz=a[0], answer_ru=a[1],
                   answer_en=a[2], order=i))
    sample_names = ["Farzandi: Aziza (8-sinf)", "Farzandi: Jasur (5-sinf)", "Farzandi: Madina (11-sinf)"]
    for i, t in enumerate(C.TESTIMONIALS):
        cname = sample_names[i] if i < len(sample_names) else ""
        db.add(Testimonial(author=t["author"], child_name=cname, child_grade=t["child_grade"], text_uz=t["text"][0],
                           text_ru=t["text"][1], text_en=t["text"][2], order=i, is_visible=True))


def seed_courses(db: Session) -> None:
    courses = [
        ("Pre-IELTS va General English", "Pre-IELTS и General English", "Pre-IELTS & General English",
         "Ingliz tili grammatikasi, so'z boyligi va erkin muloqot ko'nikmalarini oshirish. Barcha yoshdagi o'quvchilar uchun bosqichma-bosqich o'qitish dasturi.",
         "Развитие грамматики, словарного запаса и разговорной речи. Поэтапная программа для всех уровней.",
         "English grammar, vocabulary, and fluent speaking skills. Step-by-step program for students of all ages.",
         "3 oy", 600000, "Oyiga 600 000 so'm", 0),
        ("IELTS Intensive (7.0+ Kafolati)", "IELTS Intensive (Гарантия 7.0+)", "IELTS Intensive (7.0+ Guarantee)",
         "Listening, Reading, Writing va Speaking bo'yicha chuqurlashtirilgan tayyorgarlik. Mock imtihonlar va xalqaro sertifikatga ega ustozlar ko'magi.",
         "Интенсивная подготовка по всем секциям IELTS: Listening, Reading, Writing, Speaking. Пробные экзамены и опытные педагоги.",
         "Comprehensive preparation across all IELTS sections with mock tests and expert certified mentors.",
         "4 oy", 800000, "Oyiga 800 000 so'm", 1),
        ("Pre-School — Maktabga tayyorlov", "Pre-School — Подготовка к школе", "Pre-School — School Readiness",
         "5-6 yoshli bolalar uchun: savodxonlik, mantiqiy fikrlash, matematika va chet tili asoslari. Maktab muhitiga qulay moslashish.",
         "Для детей 5–6 лет: грамота, логическое мышление, арифметика и основы иностранного языка. Плавная адаптация к школе.",
         "For 5–6 year-olds: literacy, logical reasoning, mathematics, and early language foundations.",
         "6 oy", 500000, "Oyiga 500 000 so'm", 2),
        ("Mental Arifmetika va Mantiq", "Ментальная арифметика и логика", "Mental Arithmetic & Logic",
         "Miyaning o'ng va chap yarim sharlarini rivojlantirish, tezkor hisoblash hamda xotirani kuchaytirish mashg'ulotlari.",
         "Развитие обоих полушарий мозга, быстрый счёт в уме и укрепление памяти для детей школьного возраста.",
         "Fast mental calculations, photographic memory training, and balanced cognitive development.",
         "3 oy", 550000, "Oyiga 550 000 so'm", 3),
        ("Olimpiada Matematikasi", "Олимпиадная математика", "Olympiad Mathematics",
         "Murakkab masalalar yechish metodikasi, noan'anaviy yondashuv va tuman/viloyat/respublika fan olimpiadalariga maxsus tayyorgarlik.",
         "Методы решения нестандартных задач, развитие гибкого мышления и подготовка к олимпиадам всех уровней.",
         "Advanced problem solving, analytical thinking, and preparation for local and national competitions.",
         "6 oy", 700000, "Oyiga 700 000 so'm", 4),
        ("Robototexnika va IT Kids", "Робототехника и IT Kids", "Robotics & IT Kids",
         "Dasturlash asoslari (Scratch, Python), elektronika va robotlar yasash orqali zamonaviy texnologik tafakkurni shakllantirish.",
         "Основы программирования на Scratch и Python, конструирование роботов и развитие инженерного мышления.",
         "Foundations of coding in Scratch and Python, electronics, and hands-on robotics engineering.",
         "4 oy", 650000, "Oyiga 650 000 so'm", 5),
    ]
    for c in courses:
        db.add(Course(
            title_uz=c[0], title_ru=c[1], title_en=c[2],
            description_uz=c[3], description_ru=c[4], description_en=c[5],
            duration=c[6], price=c[7], price_text=c[8],
            order=c[9], is_active=True
        ))


def _post(db: Session, p: dict, refs: dict[str, int], published: datetime, event_date: datetime | None) -> None:
    row = Post(type=p["type"], slug=p["slug"], cover_id=refs.get(p["cover"][1:]), published_at=published,
               event_date=event_date,
               event_location="Toshkent, Chilonzor tumani, Bunyodkor shoh ko'chasi" if p["type"] == "event" else "")
    for j, lang in enumerate(("uz", "ru", "en")):
        setattr(row, f"title_{lang}", p["title"][j])
        setattr(row, f"excerpt_{lang}", p["excerpt"][j])
        setattr(row, f"body_{lang}", p["body"][j])
    db.add(row)


def seed_posts(db: Session, refs: dict[str, int], open_day: datetime | None) -> None:
    for p in C.POSTS:
        _post(db, p, refs, _dt(p["published"]), _dt(p["event_date"]) if p.get("event_date") else None)
    if open_day:
        _post(db, C.UPCOMING_EVENT, refs, now_local() - timedelta(days=1), open_day)


def seed_certificates(db: Session) -> None:
    items = json.loads((SEED_ASSETS_DIR / "certificates.json").read_text(encoding="utf-8"))
    cert_dir = SEED_ASSETS_DIR / "certificates"
    for i, c in enumerate(items):
        ctype = "olimpiada" if c["type"].lower() == "olimpiada" else c["type"]
        real = cert_dir / f"cert_{c['id']}.png"
        if real.exists():
            data, fname = real.read_bytes(), real.name
        else:
            data, fname = result_card_png(c), f"natija-{c['id']}.png"
        alt = f"{ctype} {c['score']} — {c['name']}"
        original = create_media(db, data, fname, private=True, alt_uz=alt + " (asl nusxa)")
        regions = C.CERT_REDACTIONS.get(c["id"], [])
        public = derive_public_copy(db, original, redact=regions or None, alt_uz=alt, alt_ru=alt, alt_en=alt)
        db.add(Certificate(
            type=ctype, score=str(c["score"]), score_value=score_value(ctype, str(c["score"]), c.get("level") or ""),
            sub_scores={k: str(v) for k, v in (c.get("subScores") or {}).items()},
            student_name=c["name"].strip().title() if c["name"].islower() else c["name"].strip(),
            grade=c.get("grade"), year=c.get("year"), date=parse_cert_date(c.get("date"), c.get("year")),
            subject=c.get("subject") or "", level=c.get("level") or "", teacher=c.get("teacher") or "",
            cert_number=c.get("certNumber") or "", image_id=public.id, original_image_id=original.id,
            redact_regions=regions, parent_consent=bool(c.get("consent")), is_featured=bool(c.get("featured")),
            is_new=bool(c.get("isNew")), order=i,
        ))


def seed_settings(db: Session) -> None:
    for k, v in {
        "site_name": "Smart Start",
        "phone": "+998 98 560 07 20",
        "telegram": "https://t.me/stmartstartt_bot",
        "instagram": "",
        "address": C.CONTACT["uz"]["address"],
        "work_hours_weekday": "Du–Ju: 08:30–17:30",
        "work_hours_saturday": "Sha: 08:30–12:00",
        "working_hours": "Du–Ju: 08:30–17:30, Sha: 08:30–12:00",
    }.items():
        db.add(SiteSetting(key=k, value=v))


def seed_tours(db: Session, rng: random.Random) -> tuple[list[Tour], datetime | None]:
    today = today_local()
    tours: list[Tour] = []
    for i in range(1, 22):
        d = today + timedelta(days=i)
        if d.weekday() == 5:
            tours.append(Tour(date=d, time=time(10, 0), capacity=30, type="ochiq_eshiklar",
                              note="Ochiq eshiklar kuni: ekskursiya + namunaviy darslar"))
        elif d.weekday() in (1, 3):
            tours.append(Tour(date=d, time=time(15, 0), capacity=10, type="ekskursiya",
                              note="Maktab bo'ylab ekskursiya (45 daqiqa)"))
    db.add_all(tours)
    db.flush()
    open_day = next((datetime.combine(t.date, t.time, tzinfo=TASHKENT) for t in tours if t.type == "ochiq_eshiklar"),
                    None)
    n = 0
    for idx, t in enumerate(tours):
        if idx == 0:
            count = t.capacity  # first excursion is fully booked (demo for TOUR_FULL)
        elif idx < 5:
            count = rng.randint(2, max(3, t.capacity // 2))
        else:
            count = rng.randint(0, 3)
        for _ in range(count):
            n += 1
            db.add(TourBooking(tour_id=t.id, parent_name=f"Demo Mehmon {n:02d}", phone=f"+99891000{n:04d}",
                               children_count=rng.choice([1, 1, 1, 2, 2, 3]),
                               created_at=datetime.now(timezone.utc) - timedelta(hours=rng.randint(1, 72))))
    return tours, open_day


NOTE_TEXTS = {
    "contacted": ["Qo'ng'iroq qilindi, ota-ona maktab haqida ma'lumot oldi.", "Telegram orqali narxlar yuborildi."],
    "tour_scheduled": ["Ekskursiyaga yozildi.", "Ota-ona shanba kungi ochiq eshiklar kuniga keladi."],
    "interview": ["Diagnostik suhbat belgilandi.", "Matematika va ingliz tilidan suhbat o'tkazildi."],
    "contract": ["Hujjatlar to'liq topshirildi.", "Shartnoma imzolandi, birinchi oy to'lovi qilindi."],
    "rejected": ["Ota-ona boshqa maktabni tanladi.", "Transport yo'nalishi to'g'ri kelmadi."],
}
FLOW = ["new", "contacted", "tour_scheduled", "interview", "contract"]


def seed_admissions(db: Session, users: dict[str, User], rng: random.Random) -> None:
    sources = (["instagram"] * 7 + ["google"] * 4 + ["telegram"] * 3 + ["facebook"] * 2 + ["referral"] + [None] * 3)
    staff = [users["manager"], users["super_admin"]]
    now = datetime.now(timezone.utc)
    for n in range(1, 41):
        age_days = 0 if n <= 3 else rng.uniform(0.2, 29.5)
        created = now - timedelta(days=age_days, hours=rng.randint(0, 6) if n > 3 else 1)
        # Older applications have progressed further through the funnel.
        if age_days < 1.5:
            status = "new"
        else:
            r = rng.random()
            max_step = min(4, int(age_days // 4) + 1)
            status = "rejected" if r < 0.12 else FLOW[rng.randint(1, max_step)]
        src = rng.choice(sources)
        campaign = {"instagram": "qabul_2027", "facebook": "qabul_2027", "google": "brand_search",
                    "telegram": "kanal_post"}.get(src)
        a = Admission(
            parent_name=f"Demo Ota-ona {n:02d}", phone=f"+99890000{n:04d}", child_name=f"Demo O'quvchi {n:02d}",
            birth_year=today_local().year - rng.randint(6, 16), target_grade=rng.randint(1, 11),
            comment=rng.choice(["", "", "Ingliz tili darajasi o'rtacha", "Transport kerak", "Olimpiadaga qiziqadi",
                                "Aka-ukasi ham o'qimoqchi"]),
            status=status, utm_source=src, utm_campaign=campaign, created_at=created, updated_at=created,
        )
        if status != "new":
            a.assigned_to_id = rng.choice(staff).id
        if status in ("contacted", "tour_scheduled"):
            a.next_call_at = now + timedelta(days=rng.randint(0, 5), hours=rng.randint(1, 8))
        db.add(a)
        db.flush()
        a.number = f"SS-{created.astimezone(TASHKENT).year}-{a.id:05d}"
        if status != "new":
            actor = db.get(User, a.assigned_to_id)
            path = FLOW[1:FLOW.index(status) + 1] if status in FLOW else ["contacted", "rejected"]
            prev = "new"
            when = created
            for st in path:
                when = when + timedelta(hours=rng.randint(2, 30))
                if when > now:
                    when = now - timedelta(minutes=rng.randint(5, 60))
                db.add(AuditLog(user_id=actor.id, action="update", entity="admission", entity_id=a.id,
                                details={"changes": {"status": {"from": prev, "to": st}}}, created_at=when))
                prev = st
            for text in NOTE_TEXTS.get(status, [])[: rng.randint(1, 2)]:
                db.add(AdmissionNote(admission_id=a.id, author_id=actor.id, text=text,
                                     created_at=min(now, created + timedelta(hours=rng.randint(3, 48)))))
    db.add(ContactMessage(name="Demo Mehmon", phone="+998900009999",
                          message="Assalomu alaykum, 3-sinf uchun joy bormi? (demo xabar)"))


def run_seed(reset: bool = False) -> None:
    if get_settings().is_production:
        raise RuntimeError("Demo seed is disabled in production.")
    init_db()
    if reset:
        log.warning("Resetting database and media…")
        Base.metadata.drop_all(bind=engine)
        wipe_media()
        init_db()
    with SessionLocal() as db:
        if db.scalar(select(User.id).limit(1)) is not None:
            log.info("Database already has data; skipping seed (use --reset to start over).")
            return
        rng = random.Random(2026)
        users = seed_users(db)
        refs = seed_media(db, users["super_admin"])
        seed_pages(db, refs)
        seed_teachers(db)
        seed_partners(db)
        seed_simple(db)
        seed_certificates(db)
        seed_settings(db)
        seed_courses(db)
        _, open_day = seed_tours(db, rng)
        seed_posts(db, refs, open_day)
        seed_admissions(db, users, rng)
        db.commit()
        counts = {m.__tablename__: db.query(m).count() for m in
                  (User, Media, Page, Teacher, Partner, Certificate, Post, Tour, TourBooking, Admission)}
        log.info("Seed complete: %s", counts)
        print("Seed complete:", counts)
