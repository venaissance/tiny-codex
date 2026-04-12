#!/bin/bash
# Start Vite dev server and Electron in parallel

# Start Vite
npx vite src/renderer --port 5173 &
VITE_PID=$!

# Wait for Vite to be ready
sleep 2

# Compile main process
npx tsc --project tsconfig.main.json --watch &
TSC_PID=$!

# Wait for compilation
sleep 2

# Start Electron
NODE_ENV=development npx electron dist/main/index.js &
ELECTRON_PID=$!

# Cleanup on exit
trap "kill $VITE_PID $TSC_PID $ELECTRON_PID 2>/dev/null" EXIT
wait
