"""Unified error format: {"code": "...", "message": "..."}."""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("smartstart.errors")


class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, extra: dict | None = None,
                 headers: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.extra = extra or {}
        self.headers = headers


def not_found(message: str = "Topilmadi") -> AppError:
    return AppError(404, "NOT_FOUND", message)


def bad_request(code: str, message: str) -> AppError:
    return AppError(400, code, message)


def conflict(code: str, message: str) -> AppError:
    return AppError(409, code, message)


STATUS_CODES = {
    400: ("BAD_REQUEST", "Noto'g'ri so'rov"),
    401: ("UNAUTHORIZED", "Avval tizimga kiring"),
    403: ("FORBIDDEN", "Bu amal uchun ruxsat yo'q"),
    404: ("NOT_FOUND", "Topilmadi"),
    405: ("METHOD_NOT_ALLOWED", "Bu usul qo'llab-quvvatlanmaydi"),
    409: ("CONFLICT", "Ziddiyat"),
    413: ("PAYLOAD_TOO_LARGE", "Fayl juda katta"),
    415: ("UNSUPPORTED_MEDIA_TYPE", "Fayl turi qo'llab-quvvatlanmaydi"),
    422: ("VALIDATION_ERROR", "Ma'lumotlar noto'g'ri"),
    429: ("RATE_LIMITED", "Juda ko'p so'rov. Birozdan keyin urinib ko'ring"),
    500: ("INTERNAL_ERROR", "Serverda xatolik yuz berdi"),
}

FIELD_MESSAGES = {
    "missing": "Majburiy maydon",
    "string_too_short": "Juda qisqa",
    "string_too_long": "Juda uzun",
    "int_parsing": "Butun son kiriting",
    "int_type": "Butun son kiriting",
    "float_parsing": "Son kiriting",
    "bool_parsing": "true yoki false bo'lishi kerak",
    "date_from_datetime_parsing": "Sana formati noto'g'ri (YYYY-MM-DD)",
    "date_parsing": "Sana formati noto'g'ri (YYYY-MM-DD)",
    "datetime_parsing": "Sana-vaqt formati noto'g'ri",
    "datetime_from_date_parsing": "Sana-vaqt formati noto'g'ri",
    "value_error": None,  # use the validator's own message
    "greater_than_equal": "Qiymat juda kichik",
    "less_than_equal": "Qiymat juda katta",
    "literal_error": "Ruxsat etilmagan qiymat",
    "enum": "Ruxsat etilmagan qiymat",
    "json_invalid": "JSON noto'g'ri",
}


def _error_body(code: str, message: str, **extra) -> dict:
    body = {"code": code, "message": message}
    body.update(extra)
    return body


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(_error_body(exc.code, exc.message, **exc.extra),
                            status_code=exc.status, headers=exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code, default_msg = STATUS_CODES.get(exc.status_code, ("ERROR", "Xatolik"))
        detail = exc.detail
        message = default_msg
        if isinstance(detail, dict):
            code = detail.get("code", code)
            message = detail.get("message", message)
        elif isinstance(detail, str) and detail and exc.status_code not in (404, 405):
            message = detail
        return JSONResponse(_error_body(code, message), status_code=exc.status_code,
                            headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        fields: dict[str, str] = {}
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path", "form")]
            key = ".".join(loc) or "body"
            etype = err.get("type", "")
            msg = FIELD_MESSAGES.get(etype)
            if msg is None:
                msg = str(err.get("msg", "Noto'g'ri qiymat")).removeprefix("Value error, ")
            fields.setdefault(key, msg)
        first = next(iter(fields.items()), None)
        message = "Ma'lumotlar noto'g'ri"
        if first:
            message = f"{message}: {first[0]} — {first[1]}"
        return JSONResponse(_error_body("VALIDATION_ERROR", message, fields=fields), status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        log.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(_error_body("INTERNAL_ERROR", STATUS_CODES[500][1]), status_code=500)
