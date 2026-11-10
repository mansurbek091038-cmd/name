"""Tiny in-memory sliding-window rate limiter (single process)."""
from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import AppError


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Register a hit. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and q[0] <= now - window_seconds:
                q.popleft()
            if len(q) >= limit:
                return False, max(1, int(q[0] + window_seconds - now) + 1)
            q.append(now)
            if now - self._last_sweep > 600:
                self._sweep(now)
            return True, 0

    def _sweep(self, now: float) -> None:
        # Drop keys untouched for a day so memory stays bounded.
        for k in [k for k, q in self._hits.items() if not q or q[-1] < now - 86400]:
            del self._hits[k]
        self._last_sweep = now

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce(request: Request, bucket: str, limit: int, window_seconds: int, key_extra: str = "") -> None:
    if not get_settings().rate_limit_enabled:
        return
    key = f"{bucket}:{client_ip(request)}:{key_extra}"
    ok, retry = limiter.hit(key, limit, window_seconds)
    if not ok:
        raise AppError(429, "RATE_LIMITED",
                       "Juda ko'p urinish. Iltimos, birozdan keyin qayta urinib ko'ring.",
                       headers={"Retry-After": str(retry)})


def rate_limit(bucket: str, limit: int, window_seconds: int):
    """FastAPI dependency factory."""

    def _dep(request: Request) -> None:
        enforce(request, bucket, limit, window_seconds)

    return _dep
