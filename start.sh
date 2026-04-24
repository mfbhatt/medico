#!/bin/bash

set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
REQUIREMENTS_MARKER="$BACKEND_DIR/.requirements_installed"

# ─── Redis ──────────────────────────────────────────────────────────────────

echo ">>> Checking Redis..."
if redis-cli ping > /dev/null 2>&1; then
  echo "    Redis already running."
elif command -v redis-server > /dev/null 2>&1; then
  echo "    Starting Redis..."
  redis-server --daemonize yes --loglevel warning
  sleep 1
  redis-cli ping > /dev/null 2>&1 && echo "    Redis started." || echo "    WARNING: Could not start Redis. Cache will use in-memory fallback."
else
  echo "    Redis not installed. Cache will use in-memory fallback."
  echo "    To install Redis: brew install redis && brew services start redis"
fi

# ─── Backend ────────────────────────────────────────────────────────────────

echo ">>> Setting up backend..."

# Create venv only if it doesn't exist
if [ ! -d "$VENV_DIR" ]; then
  echo "    Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

# Activate venv
source "$VENV_DIR/bin/activate"

# Install requirements only on first run (marker file tracks this)
if [ ! -f "$REQUIREMENTS_MARKER" ]; then
  echo "    Installing Python dependencies (first time)..."
  pip install -r "$BACKEND_DIR/requirements.txt"
  touch "$REQUIREMENTS_MARKER"
else
  echo "    Requirements already installed. Skipping."
fi

echo "    Starting backend on http://localhost:8000 ..."
cd "$BACKEND_DIR"
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd "$ROOT_DIR"

# ─── Frontend ───────────────────────────────────────────────────────────────

echo ""
echo ">>> Setting up frontend..."

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "    Installing Node dependencies (first time)..."
  npm install
else
  echo "    node_modules already present. Skipping npm install."
fi

echo "    Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

# ─── Wait / Cleanup ─────────────────────────────────────────────────────────

echo ""
echo "Both services are running."
echo "  Backend  → http://localhost:8000"
echo "  Frontend → http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID
