#!/bin/bash
# Dev mode with hot reload:
# - vite build --watch: recompiles renderer on source change
# - tsc --watch: recompiles main process on source change
# - Electron main process watches dist/ and auto-reloads (DEV_MODE=1)

set -e
cd "$(dirname "$0")/.."

# Initial build
echo "[dev] Building renderer..."
npx vite build 2>&1 | tail -3

echo "[dev] Compiling main process..."
npx tsc --project tsconfig.main.json

# Watch for changes in background
npx vite build --watch 2>&1 | sed 's/^/[vite] /' &
VITE_PID=$!

npx tsc --project tsconfig.main.json --watch 2>&1 | sed 's/^/[tsc] /' &
TSC_PID=$!

sleep 1

# Start Electron with dev mode flag — enables hot reload watcher inside main process
echo "[dev] Starting Electron with hot reload..."
DEV_MODE=1 npx electron dist/main/main/index.js &
ELECTRON_PID=$!

# Cleanup on exit
trap "kill $VITE_PID $TSC_PID $ELECTRON_PID 2>/dev/null" EXIT
wait
