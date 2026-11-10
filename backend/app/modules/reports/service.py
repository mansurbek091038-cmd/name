"""Dashboard numbers and Excel export."""
from __future__ import annotations

import io
from collections import Counter
from datetime import timedelta

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.utils import TASHKENT, format_uz_phone, local_day_bounds_utc, today_local
from app.modules.admissions.models import STATUSES, Admission, AdmissionNote
from app.modules.events.models import Tour, TourBooking

STATUS_UZ = {
    "new": "Yangi", "contacted": "Bog'lanildi", "tour_scheduled": "Ekskursiya belgilandi",
    "interview": "Suhbat", "contract": "Shartnoma", "rejected": "Rad etildi",
}


def dashboard(db: Session) -> dict:
    from app.modules.admissions.router import admission_out

    today = today_local()
    day_start, day_end = local_day_bounds_utc(today)
    month_start = local_day_bounds_utc(today.replace(day=1))[0]
    since = local_day_bounds_utc(today - timedelta(days=29))[0]

    total = db.scalar(select(func.count()).select_from(Admission)) or 0
    new_today = db.scalar(select(func.count()).select_from(Admission).where(
        Admission.created_at >= day_start, Admission.created_at < day_end)) or 0
    this_month = db.scalar(select(func.count()).select_from(Admission).where(
        Admission.created_at >= month_start)) or 0
    contracts = db.scalar(select(func.count()).select_from(Admission).where(Admission.status == "contract")) or 0

    by_status_raw = dict(db.execute(select(Admission.status, func.count()).group_by(Admission.status)).all())
    by_source_raw = db.execute(select(Admission.utm_source, func.count()).group_by(Admission.utm_source)).all()
    by_grade_raw = db.execute(select(Admission.target_grade, func.count())
                              .group_by(Admission.target_grade).order_by(Admission.target_grade)).all()

    days = Counter()
    for (created,) in db.execute(select(Admission.created_at).where(Admission.created_at >= since)).all():
        days[created.astimezone(TASHKENT).date()] += 1
    by_day = [{"date": (today - timedelta(days=i)).isoformat(), "count": days.get(today - timedelta(days=i), 0)}
              for i in range(29, -1, -1)]

    tours_upcoming = db.scalar(select(func.count()).select_from(Tour).where(
        Tour.date >= today, Tour.is_active.is_(True))) or 0
    bookings_upcoming = db.scalar(select(func.count()).select_from(TourBooking).join(Tour).where(
        Tour.date >= today, Tour.is_active.is_(True))) or 0

    recent_rows = db.scalars(select(Admission).order_by(Admission.created_at.desc(), Admission.id.desc())
                             .limit(5)).unique().all()
    ids = [a.id for a in recent_rows]
    counts = dict(db.execute(select(AdmissionNote.admission_id, func.count())
                             .where(AdmissionNote.admission_id.in_(ids))
                             .group_by(AdmissionNote.admission_id)).all()) if ids else {}

    sources = sorted(((s or "direct", c) for s, c in by_source_raw), key=lambda x: -x[1])
    return {
        "totals": {
            "admissions": total,
            "new_today": new_today,
            "this_month": this_month,
            "conversion_rate": round(contracts * 100 / total, 1) if total else 0.0,
            "tours_upcoming": tours_upcoming,
            "bookings_upcoming": bookings_upcoming,
        },
        "by_status": [{"status": s, "count": by_status_raw.get(s, 0)} for s in STATUSES],
        "by_source": [{"source": s, "count": c} for s, c in sources],
        "by_day": by_day,
        "by_grade": [{"grade": g, "count": c} for g, c in by_grade_raw],
        "recent": [admission_out(a, counts.get(a.id, 0)) for a in recent_rows],
    }


def _safe(v):
    """Prevent formula injection: openpyxl stores strings starting with '=' as formulas."""
    if isinstance(v, str) and v.startswith("="):
        return "'" + v
    return v


def admissions_xlsx(db: Session, rows: list[Admission]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Arizalar"
    headers = ["№", "Ariza raqami", "Sana", "Ota-ona", "Telefon", "Farzand", "Tug'ilgan yil", "Sinf",
               "Holat", "Mas'ul", "Qayta qo'ng'iroq", "Manba (utm_source)", "Kampaniya", "Izoh",
               "Izohlar soni"]
    ws.append(headers)
    head_fill = PatternFill("solid", fgColor="13294B")
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = head_fill
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ids = [a.id for a in rows]
    counts = dict(db.execute(select(AdmissionNote.admission_id, func.count())
                             .where(AdmissionNote.admission_id.in_(ids))
                             .group_by(AdmissionNote.admission_id)).all()) if ids else {}
    for i, a in enumerate(rows, 1):
        created = a.created_at.astimezone(TASHKENT).replace(tzinfo=None)
        next_call = a.next_call_at.astimezone(TASHKENT).replace(tzinfo=None) if a.next_call_at else None
        ws.append([
            i, a.number, created, _safe(a.parent_name), format_uz_phone(a.phone), _safe(a.child_name),
            a.birth_year, a.target_grade, STATUS_UZ.get(a.status, a.status),
            a.assigned_to.full_name if a.assigned_to else "", next_call, _safe(a.utm_source or "sayt"),
            _safe(a.utm_campaign or ""), _safe(a.comment or ""), counts.get(a.id, 0),
        ])
    for row in ws.iter_rows(min_row=2):
        row[2].number_format = "dd.mm.yyyy hh:mm"
        row[10].number_format = "dd.mm.yyyy hh:mm"
    widths = [5, 16, 17, 24, 18, 22, 12, 6, 20, 20, 17, 18, 18, 40, 10]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(idx)].width = w
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions

    # Summary sheet
    s = wb.create_sheet("Xulosa")
    s.append(["Holat", "Soni"])
    status_counts = Counter(a.status for a in rows)
    for st in STATUSES:
        s.append([STATUS_UZ[st], status_counts.get(st, 0)])
    s.append([])
    s.append(["Manba", "Soni"])
    for src, c in Counter(a.utm_source or "sayt" for a in rows).most_common():
        s.append([_safe(src), c])
    for cell in (s["A1"], s["B1"]):
        cell.font = Font(bold=True)
    s.column_dimensions["A"].width = 26

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
