from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import require_admin
from app.modules.auth.models import User
from app.modules.reports.service import dashboard

router = APIRouter(prefix="/admin/reports", tags=["admin: reports"])


@router.get("/dashboard", summary="Dashboard statistikasi (admin)")
def get_dashboard(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return dashboard(db)
