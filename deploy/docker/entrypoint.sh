#!/bin/sh
set -e

# Start the native engine server in background
echo "[chainsolve] Starting engine server on port ${ENGINE_PORT:-3099}..."
/usr/local/bin/chainsolve-engine --port "${ENGINE_PORT:-3099}" &
ENGINE_PID=$!

# Start nginx in foreground
echo "[chainsolve] Starting nginx..."
exec nginx -g "daemon off;"

# Cleanup on exit
trap "kill $ENGINE_PID 2>/dev/null" EXIT
