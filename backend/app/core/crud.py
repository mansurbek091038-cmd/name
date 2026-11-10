"""Generic admin CRUD router factory (list/create/get/update/delete/order) with audit logging."""

from collections.abc import Callable
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from pydantic import BaseModel, create_model
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.audit import audit, diff, snapshot
from app.core.db import get_db
from app.core.errors import AppError
from app.core.security import require_role
from app.core.utils import paginate
from app.modules.auth.models import User


def make_partial(model: type[BaseModel], name: str | None = None) -> type[BaseModel]:
    """Copy of a pydantic model where every field is optional (for PUT/PATCH)."""
    fields: dict[str, Any] = {}
    for fname, f in model.model_fields.items():
        fields[fname] = (Optional[f.annotation], None)
    # Subclassing keeps the field validators of the original model.
    return create_model(name or f"{model.__name__}Update", __base__=model, **fields)


class OrderIn(BaseModel):
    order: int


class ReorderIn(BaseModel):
    ids: list[int]


def crud_router(
    *,
    prefix: str,
    tag: str,
    model,
    entity: str,
    create_schema: type[BaseModel],
    to_admin: Callable[[Session, Any], dict],
    search_fields: tuple[str, ...] = (),
    default_order: Callable[[Any], list] | None = None,
    filters: dict[str, tuple[str, Callable[[str], Any]]] | None = None,
    prepare: Callable[[Session, dict, Any | None, User], dict] | None = None,
    after_save: Callable[[Session, Any, dict, User], None] | None = None,
    before_delete: Callable[[Session, Any, User], None] | None = None,
    min_role: str = "manager",
    delete_role: str | None = None,
    has_order: bool = True,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])
    update_schema = make_partial(create_schema, f"{create_schema.__name__}Update")
    guard = require_role(min_role)
    del_guard = require_role(delete_role or min_role)
    filters = filters or {}

    def _get(db: Session, item_id: int):
        obj = db.get(model, item_id)
        if obj is None:
            raise AppError(404, "NOT_FOUND", "Yozuv topilmadi")
        return obj

    def _order_by():
        if default_order:
            return default_order(model)
        if has_order and hasattr(model, "order"):
            return [model.order.asc(), model.id.asc()]
        return [model.id.desc()]

    @router.get("", summary=f"{tag}: ro'yxat")
    def list_items(
        request: Request,
        search: str | None = Query(None, max_length=100),
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
        db: Session = Depends(get_db),
        _: User = Depends(guard),
    ):
        stmt = select(model)
        if search and search_fields:
            like = f"%{search.strip()}%"
            stmt = stmt.where(or_(*[getattr(model, f).ilike(like) for f in search_fields]))
        for qname, spec in filters.items():
            raw = request.query_params.get(qname)
            if raw in (None, ""):
                continue
            try:
                if callable(spec):  # custom filter: fn(stmt, raw) -> stmt
                    stmt = spec(stmt, raw)
                    continue
                col, caster = spec
                val = caster(raw)
            except (TypeError, ValueError):
                raise AppError(422, "VALIDATION_ERROR", f"{qname} noto'g'ri",
                               extra={"fields": {qname: "Noto'g'ri qiymat"}}) from None
            stmt = stmt.where(getattr(model, col) == val)
        stmt = stmt.order_by(*_order_by())
        return paginate(db, stmt, page, page_size, lambda o: to_admin(db, o))

    @router.post("", status_code=201, summary=f"{tag}: yaratish")
    def create_item(
        request: Request,
        payload: create_schema = Body(...),  # type: ignore[valid-type]
        db: Session = Depends(get_db),
        user: User = Depends(guard),
    ):
        data = payload.model_dump(exclude_unset=False)
        if prepare:
            data = prepare(db, data, None, user)
        obj = model(**{k: v for k, v in data.items() if hasattr(model, k)})
        db.add(obj)
        db.flush()
        if after_save:
            after_save(db, obj, data, user)
        audit(db, user, "create", entity, obj.id, {"after": snapshot(obj)}, request)
        db.commit()
        db.refresh(obj)
        return to_admin(db, obj)

    @router.get("/{item_id}", summary=f"{tag}: bitta yozuv")
    def get_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(guard)):
        return to_admin(db, _get(db, item_id))

    @router.put("/{item_id}", summary=f"{tag}: tahrirlash")
    def update_item(
        item_id: int,
        request: Request,
        payload: update_schema = Body(...),  # type: ignore[valid-type]
        db: Session = Depends(get_db),
        user: User = Depends(guard),
    ):
        obj = _get(db, item_id)
        before = snapshot(obj)
        data = payload.model_dump(exclude_unset=True)
        if prepare:
            data = prepare(db, data, obj, user)
        for k, v in data.items():
            if hasattr(model, k) and k != "id":
                setattr(obj, k, v)
        db.flush()
        if after_save:
            after_save(db, obj, data, user)
        changes = diff(before, snapshot(obj))
        if changes:
            audit(db, user, "update", entity, obj.id, {"changes": changes}, request)
        db.commit()
        db.refresh(obj)
        return to_admin(db, obj)

    @router.delete("/{item_id}", status_code=204, summary=f"{tag}: o'chirish")
    def delete_item(item_id: int, request: Request, db: Session = Depends(get_db),
                    user: User = Depends(del_guard)):
        obj = _get(db, item_id)
        snap = snapshot(obj)
        if before_delete:
            before_delete(db, obj, user)
        db.delete(obj)
        audit(db, user, "delete", entity, item_id, {"before": snap}, request)
        db.commit()
        return Response(status_code=204)

    if has_order and hasattr(model, "order"):

        @router.patch("/{item_id}/order", summary=f"{tag}: tartib raqami")
        def set_order(item_id: int, body: OrderIn, request: Request,
                      db: Session = Depends(get_db), user: User = Depends(guard)):
            obj = _get(db, item_id)
            old = obj.order
            obj.order = body.order
            audit(db, user, "reorder", entity, obj.id, {"changes": {"order": {"from": old, "to": body.order}}},
                  request)
            db.commit()
            return to_admin(db, obj)

        @router.post("/reorder", summary=f"{tag}: tartibni ommaviy o'zgartirish")
        def bulk_reorder(body: ReorderIn, request: Request, db: Session = Depends(get_db),
                         user: User = Depends(guard)):
            for idx, item_id in enumerate(body.ids):
                obj = db.get(model, item_id)
                if obj is not None:
                    obj.order = idx
            audit(db, user, "reorder", entity, None, {"ids": body.ids}, request)
            db.commit()
            return {"ok": True}

    return router
