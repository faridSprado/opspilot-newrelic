#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
fi

PY_CMD=""
if command -v python3.11 >/dev/null 2>&1; then
  PY_CMD="python3.11"
elif command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)' >/dev/null 2>&1; then
  PY_CMD="python3"
fi

if [ -z "$PY_CMD" ]; then
  echo "ERROR: Python 3.11.x is required. Recommended: Python 3.11.9."
  exit 1
fi

if [ ! -x backend/.venv/bin/python ] || ! backend/.venv/bin/python -c 'import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)' >/dev/null 2>&1; then
  rm -rf backend/.venv
  "$PY_CMD" -m venv backend/.venv
fi

source backend/.venv/bin/activate
python -m pip install --upgrade "pip==25.3"
python -m pip install -r backend/requirements.txt

if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install --legacy-peer-deps)
fi

( python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --app-dir backend ) &
( cd frontend && npm run dev ) &
wait
