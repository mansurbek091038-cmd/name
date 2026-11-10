# ==============================================================================
# Smart Start — Production Multi-Stage Dockerfile
# Stage 1: Build the React + TypeScript frontend with Vite
# Stage 2: Hardened, minimal Python 3.12 runtime with Uvicorn
# ==============================================================================

# ---------- Stage 1: Frontend Build ----------
FROM node:20-alpine AS web
WORKDIR /src/frontend

# Cache dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copy frontend source and compile assets into /src/backend/app/static
COPY frontend/ ./
RUN mkdir -p /src/backend/app/static && npm run build

# ---------- Stage 2: Production Python Runtime ----------
FROM python:3.12-slim-bookworm

# Environment configuration
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000 \
    DATA_DIR=/app/data \
    MEDIA_ROOT=/app/media \
    BACKUP_DIR=/app/data/backups \
    TZ=Asia/Tashkent

# Install system dependencies
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      postgresql-client \
      fonts-dejavu-core \
      tzdata \
      curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy backend application code and compiled frontend assets
COPY backend/ /app/backend/
COPY --from=web /src/backend/app/static/ /app/backend/app/static/
COPY .env.example /app/.env.example

# Create dedicated non-root application user and setup writeable directories
RUN useradd --system --uid 1000 --home /app smartstart \
 && mkdir -p /app/data/logs /app/data/backups /app/media/public /app/media/private/originals \
 && chown -R smartstart:smartstart /app

USER smartstart

# Document exposed port (Koyeb/Render/Cloud Run default)
EXPOSE 8000

# Container healthcheck: dynamically probes $PORT and checks /api/v1/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import os, urllib.request; port = os.environ.get('PORT', '8000'); urllib.request.urlopen(f'http://127.0.0.1:{port}/api/v1/health', timeout=4)" || exit 1

WORKDIR /app/backend

# Production startup: dynamically respects $PORT from cloud platforms (Koyeb/Render/Railway)
# Uses exec so uvicorn receives PID 1 signals (SIGTERM/SIGINT) for graceful shutdown
CMD ["sh", "-c", "exec python -m uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\" --proxy-headers --forwarded-allow-ips '*'"]
