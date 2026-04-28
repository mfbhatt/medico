#!/bin/bash

set -e

# Root paths
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/venv"
REQUIREMENTS_MARKER="$BACKEND_DIR/.requirements_installed"

echo "=== Checking Redis ==="

if command -v redis-cli >/dev/null 2>&1; then
  if redis-cli ping >/dev/null 2>&1; then
    echo "Redis already running."
  else
    if command -v redis-server >/dev/null 2>&1; then
      echo "Starting Redis..."
      redis-server --daemonize yes >/dev/null 2>&1 || true
      sleep 1
    else
      echo "Redis not installed. Using in-memory fallback."
      echo "Install Redis: sudo apt install redis-server OR brew install redis"
    fi
  fi
else
  echo "Redis not installed. Using in-memory fallback."
  echo "Install Redis: sudo apt install redis-server OR brew install redis"
fi

echo ""
echo "=== Setting up backend ==="

# Create venv if not exists
if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtual environment..."
  python3 -m venv "$VENV_DIR"
fi

# Activate venv (cross-platform)
if [ -f "$VENV_DIR/bin/activate" ]; then
  source "$VENV_DIR/bin/activate"
elif [ -f "$VENV_DIR/Scripts/activate" ]; then
  source "$VENV_DIR/Scripts/activate"
else
  echo "ERROR: Virtual environment activation script not found"
  exit 1
fi

# Install dependencies once
if [ ! -f "$REQUIREMENTS_MARKER" ]; then
  echo "Installing Python dependencies first time..."
  pip install -r "$BACKEND_DIR/requirements.txt"
  touch "$REQUIREMENTS_MARKER"
else
  echo "Requirements already installed. Skipping."
fi

echo "Starting backend on http://localhost:8000 ..."
cd "$BACKEND_DIR"
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

cd "$ROOT_DIR"

echo ""
echo "=== Setting up frontend ==="

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  echo "Installing Node dependencies first time..."
  npm install
else
  echo "node_modules already present. Skipping npm install."
fi

echo "Starting frontend on http://localhost:5173 ..."
npm run dev &
FRONTEND_PID=$!

cd "$ROOT_DIR"

echo ""
echo "Both services are running."
echo "Backend  - http://localhost:8000"
echo "Frontend - http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."

# Cleanup
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait $BACKEND_PID $FRONTEND_PID