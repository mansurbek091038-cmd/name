#!/usr/bin/env bash
# Smart Start — bitta buyruq bilan ishga tushirish (Linux / macOS)
#   ./run.sh            -> http://localhost:8000
#   PORT=9000 ./run.sh  -> boshqa port
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8000}"
HOST="${HOST:-0.0.0.0}"

PY="$(command -v python3 || command -v python || true)"
if [ -z "$PY" ]; then
  echo "Python topilmadi. Python 3.10+ o'rnating: https://www.python.org/downloads/"
  exit 1
fi
"$PY" - <<'EOF' || { echo "Python 3.10 yoki undan yangi versiya kerak."; exit 1; }
import sys
sys.exit(0 if sys.version_info >= (3, 10) else 1)
EOF

if [ ! -d .venv ]; then
  echo ">> Virtual muhit yaratilmoqda (.venv)…"
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

if [ ! -f .venv/.installed ] || [ requirements.txt -nt .venv/.installed ]; then
  echo ">> Kutubxonalar o'rnatilmoqda…"
  python -m pip install --upgrade pip >/dev/null
  python -m pip install -r requirements.txt
  touch .venv/.installed
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo ">> .env fayli yaratildi (.env.example dan). Kerak bo'lsa tahrirlang."
fi

echo ""
echo "=============================================================="
echo "  Smart Start ishga tushmoqda:  http://localhost:${PORT}"
echo "  API hujjati (Swagger):        http://localhost:${PORT}/api/docs"
echo "  To'xtatish: Ctrl+C"
echo "=============================================================="
cd backend
exec python -m uvicorn app.main:app --host "$HOST" --port "$PORT" --proxy-headers
