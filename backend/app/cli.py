"""Command line tools.

    python -m app.cli seed [--reset]
    python -m app.cli create-user --email x@y.uz --name "Ism Familiya" --role admin [--password ...]
    python -m app.cli backup [--with-media] [--keep 30]
    python -m app.cli clear-demo
"""
from __future__ import annotations

import argparse
import getpass
import gzip
import logging
import os
import shutil
import sqlite3
import subprocess
import sys
import tarfile
from datetime import datetime
from pathlib import Path
from psycopg.conninfo import conninfo_to_dict, make_conninfo
from sqlalchemy.engine import make_url

from app.core.config import BACKEND_DIR, get_settings

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def cmd_seed(args) -> int:
    from seed.seed import run_seed

    if args.reset and not args.yes:
        ans = input("DIQQAT: barcha ma'lumotlar va yuklangan rasmlar o'chiriladi. Davom etasizmi? [ha/yo'q]: ")
        if ans.strip().lower() not in ("ha", "h", "yes", "y"):
            print("Bekor qilindi.")
            return 1
    run_seed(reset=args.reset)
    return 0


def cmd_clear_demo(args) -> int:
    """Remove the demo CRM records (applications, bookings, messages) but keep the site content."""
    from sqlalchemy import delete

    from app.core.db import SessionLocal, init_db
    from app.modules.admissions.models import Admission, ContactMessage
    from app.modules.auth.models import AuditLog
    from app.modules.events.models import TourBooking

    init_db()
    with SessionLocal() as db:
        ids = [a.id for a in db.query(Admission).filter(Admission.parent_name.like("Demo %")).all()]
        if ids:
            db.execute(delete(AuditLog).where(AuditLog.entity == "admission", AuditLog.entity_id.in_(ids)))
            for a in db.query(Admission).filter(Admission.id.in_(ids)).all():
                db.delete(a)
        b = db.execute(delete(TourBooking).where(TourBooking.parent_name.like("Demo %"))).rowcount
        m = db.execute(delete(ContactMessage).where(ContactMessage.name.like("Demo %"))).rowcount
        db.commit()
    print(f"O'chirildi: {len(ids)} ta demo ariza, {b} ta demo yozilish, {m} ta demo xabar.")
    return 0


def cmd_create_user(args) -> int:
    from sqlalchemy import func, select

    from app.core.db import SessionLocal, init_db
    from app.core.errors import AppError
    from app.core.security import hash_password, validate_password_strength
    from app.modules.auth.models import User

    init_db()
    password = args.password or getpass.getpass("Parol: ")
    try:
        validate_password_strength(password)
    except AppError as e:
        print("Xato:", e.message)
        return 1
    email = args.email.strip().lower()
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(func.lower(User.email) == email))
        if existing:
            if not args.update:
                print(f"Xato: {email} allaqachon mavjud (parolni yangilash uchun --update qo'shing)")
                return 1
            existing.password_hash = hash_password(password)
            existing.role = args.role
            existing.is_active = True
            existing.token_version += 1
            if args.name:
                existing.full_name = args.name
            db.commit()
            print(f"Yangilandi: {email} ({args.role})")
            return 0
        db.add(User(email=email, full_name=args.name or email.split("@")[0], role=args.role,
                    password_hash=hash_password(password), is_active=True))
        db.commit()
    print(f"Yaratildi: {email} ({args.role})")
    return 0


def _prune(folder: Path, pattern: str, keep: int) -> list[Path]:
    files = sorted(folder.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    removed = []
    for old in files[keep:]:
        old.unlink(missing_ok=True)
        removed.append(old)
    return removed


def cmd_backup(args) -> int:
    s = get_settings()
    keep = args.keep or s.backup_keep
    out_dir = Path(args.dir).resolve() if args.dir else s.backup_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    url = s.sqlalchemy_url

    if url.startswith("sqlite"):
        db_path = Path(url.replace("sqlite:///", "", 1))
        if not db_path.exists():
            print(f"Xato: baza topilmadi: {db_path}")
            return 1
        tmp = out_dir / f"smartstart-{stamp}.db"
        src = sqlite3.connect(str(db_path))
        dst = sqlite3.connect(str(tmp))
        with dst:
            src.backup(dst)  # consistent snapshot even while the server is running
        src.close()
        dst.close()
        target = out_dir / f"smartstart-db-{stamp}.db.gz"
        with open(tmp, "rb") as fi, gzip.open(target, "wb", compresslevel=6) as fo:
            shutil.copyfileobj(fi, fo)
        tmp.unlink()
    else:
        pg_url = make_url(url).set(drivername="postgresql")
        # Keep the password out of argv and preserve provider options such as sslmode.
        params = conninfo_to_dict(pg_url.render_as_string(hide_password=False))
        env = os.environ.copy()
        password = params.pop("password", None)
        if password is not None:
            env["PGPASSWORD"] = password
        target = out_dir / f"smartstart-db-{stamp}.sql.gz"
        cmd = ["pg_dump", "--no-owner", "--no-privileges", "--dbname", make_conninfo(**params)]
        try:
            proc = subprocess.run(cmd, env=env, capture_output=True, check=True)
        except FileNotFoundError:
            print("Xato: pg_dump topilmadi (postgresql-client o'rnating)")
            return 1
        except subprocess.CalledProcessError as e:
            print("Xato: pg_dump:", e.stderr.decode(errors="ignore")[:500])
            return 1
        with gzip.open(target, "wb", compresslevel=6) as fo:
            fo.write(proc.stdout)

    print(f"Zaxira nusxa: {target} ({target.stat().st_size // 1024} KB)")
    removed = _prune(out_dir, "smartstart-db-*", keep)

    if args.with_media:
        mtarget = out_dir / f"smartstart-media-{stamp}.tar.gz"
        with tarfile.open(mtarget, "w:gz") as tar:
            tar.add(str(s.media_root), arcname="media")
        print(f"Media zaxirasi: {mtarget} ({mtarget.stat().st_size // 1024} KB)")
        removed += _prune(out_dir, "smartstart-media-*", keep)
    if removed:
        print(f"Eski nusxalar o'chirildi: {len(removed)} ta (oxirgi {keep} tasi saqlanadi)")
    return 0


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    ap = argparse.ArgumentParser(prog="python -m app.cli", description="Smart Start boshqaruv buyruqlari")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("seed", help="Bazaga boshlang'ich (demo) ma'lumotlarni yuklash")
    p.add_argument("--reset", action="store_true", help="Bazani va media papkani tozalab, qaytadan yuklash")
    p.add_argument("--yes", "-y", action="store_true", help="Tasdiq so'ramaslik")
    p.set_defaults(func=cmd_seed)

    p = sub.add_parser("clear-demo", help="Demo arizalar/yozilishlarni o'chirish (kontent qoladi)")
    p.set_defaults(func=cmd_clear_demo)

    p = sub.add_parser("create-user", help="Xodim yaratish yoki parolini yangilash")
    p.add_argument("--email", required=True)
    p.add_argument("--name", default="")
    p.add_argument("--role", choices=["manager", "admin", "super_admin"], default="manager")
    p.add_argument("--password", help="Bo'sh qoldirilsa, so'raladi")
    p.add_argument("--update", action="store_true", help="Mavjud bo'lsa parol/rolni yangilash")
    p.set_defaults(func=cmd_create_user)

    p = sub.add_parser("backup", help="Bazaning zaxira nusxasi (oxirgi 30 tasi saqlanadi)")
    p.add_argument("--with-media", action="store_true", help="Rasmlarni ham arxivlash")
    p.add_argument("--keep", type=int, default=0, help="Nechta nusxa saqlansin (standart: BACKUP_KEEP=30)")
    p.add_argument("--dir", help="Zaxira papkasi (standart: data/backups)")
    p.set_defaults(func=cmd_backup)

    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
