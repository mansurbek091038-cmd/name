"""Pure ASGI middleware: security headers, cache headers, request timing log."""
from __future__ import annotations

import logging
import time

from app.core.config import get_settings

log = logging.getLogger("smartstart.http")

DEFAULT_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://www.googletagmanager.com "
    "https://www.google-analytics.com https://mc.yandex.ru https://connect.facebook.net https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
    "font-src 'self' data: https://fonts.gstatic.com; "
    "img-src 'self' data: blob: https:; "
    "media-src 'self' blob: https:; "
    "connect-src 'self' https:; "
    "worker-src 'self' blob:; "
    "frame-src https://challenges.cloudflare.com https://www.google.com https://maps.google.com "
    "https://yandex.uz https://yandex.ru https://yandex.com https://www.youtube.com https://www.youtube-nocookie.com; "
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'"
)


class SecurityHeadersMiddleware:
    def __init__(self, app):
        self.app = app
        s = get_settings()
        self.hsts = s.is_production and s.site_url.startswith("https://")
        self.csp = (s.content_security_policy or DEFAULT_CSP) if s.csp_enabled else ""

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path: str = scope.get("path", "")
        method: str = scope.get("method", "GET")
        start = time.perf_counter()
        status_holder = {"status": 0}

        async def _send(message):
            if message["type"] == "http.response.start":
                status_holder["status"] = message["status"]
                headers = list(message.get("headers", []))
                existing = {k.lower() for k, _ in headers}

                def add(name: str, value: str):
                    if name.encode() not in existing:
                        headers.append((name.encode(), value.encode()))

                add("x-content-type-options", "nosniff")
                add("x-frame-options", "DENY")
                add("referrer-policy", "strict-origin-when-cross-origin")
                add("permissions-policy", "camera=(), microphone=(), geolocation=(), payment=()")
                add("cross-origin-opener-policy", "same-origin")
                if self.hsts:
                    add("strict-transport-security", "max-age=31536000; includeSubDomains")
                ctype = next((v for k, v in headers if k.lower() == b"content-type"), b"")
                if self.csp and ctype.startswith(b"text/html"):
                    add("content-security-policy", self.csp)
                # Caching
                if path.startswith("/assets/"):
                    add("cache-control", "public, max-age=31536000, immutable")
                elif path.startswith("/media/public/"):
                    add("cache-control", "public, max-age=2592000")
                elif (path.startswith("/api/v1/public/") and not path.startswith(("/api/v1/public/tours", "/api/v1/public/certificates"))
                      and method == "GET" and message["status"] == 200):
                    add("cache-control", "public, max-age=30")
                elif path.startswith("/api/"):
                    add("cache-control", "no-store")
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, _send)
        finally:
            if path.startswith("/api/"):
                ms = (time.perf_counter() - start) * 1000
                log.info("%s %s -> %s (%.0f ms)", method, path, status_holder["status"], ms)
