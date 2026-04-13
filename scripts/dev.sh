#!/bin/bash
# Dev mode: build + watch for changes, then start Electron
# Uses vite build --watch (NOT dev server) so Tailwind v4 fully compiles utility classes.

set -e

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

# Wait for watchers to initialize
sleep 1

# Start Electron (loads from dist/, not dev server)
echo "[dev] Starting Electron..."
npx electron dist/main/main/index.js &
ELECTRON_PID=$!

# Cleanup on exit
trap "kill $VITE_PID $TSC_PID $ELECTRON_PID 2>/dev/null" EXIT
wait
