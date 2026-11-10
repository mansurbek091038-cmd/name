# ---------- 1) Frontend (React + Vite) build ----------
FROM node:20-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
# vite.config.ts writes the build into ../backend/app/static
RUN npm run build

# ---------- 2) Python backend ----------
FROM python:3.12-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Tashkent

# postgresql-client: `python -m app.cli backup` uses pg_dump; DejaVu font: seed images
RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client fonts-dejavu-core tzdata \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY backend/ backend/
COPY --from=web /src/backend/app/static/ backend/app/static/
COPY .env.example .env.example

RUN useradd --system --uid 1000 --home /app smartstart \
 && mkdir -p /app/data /app/media \
 && chown -R smartstart:smartstart /app
USER smartstart

ENV DATA_DIR=/app/data MEDIA_ROOT=/app/media
VOLUME ["/app/data", "/app/media"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4)" || exit 1

WORKDIR /app/backend
# One worker: the rate limiter and booking lock live in process memory.
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
