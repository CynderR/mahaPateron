#!/bin/bash

# Stop dev servers, stale nodemon, and (optionally) the pm2 production backend
# so port 5000 is free. Safe to run before ./start-dev.sh on a production host.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

BACKEND_PORT="${BACKEND_PORT:-5000}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"
STOP_PM2="${STOP_PM2:-1}"

kill_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v ss >/dev/null 2>&1; then
    local pids
    pids=$(ss -tlnpH "sport = :${port}" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs -r kill -9 2>/dev/null || true
    fi
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:"${port}" | xargs -r kill -9 2>/dev/null || true
  fi
}

echo -e "${YELLOW}Stopping dev/production processes on ports ${BACKEND_PORT} and ${FRONTEND_PORT}...${NC}"

if [ "$STOP_PM2" = "1" ] && command -v pm2 >/dev/null 2>&1; then
  if pm2 list 2>/dev/null | grep -q user-management-backend; then
    echo -e "${YELLOW}Stopping pm2 app: user-management-backend${NC}"
    pm2 stop user-management-backend 2>/dev/null || true
  fi
fi

# Leftover nodemon from a previous ./start-dev.sh (git pull can trigger restarts).
pkill -f "nodemon server.js" 2>/dev/null || true
pkill -f "react-scripts start" 2>/dev/null || true

kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"
sleep 1

if command -v ss >/dev/null 2>&1; then
  if ss -tlnH "sport = :${BACKEND_PORT}" 2>/dev/null | grep -q .; then
    echo -e "${RED}Port ${BACKEND_PORT} is still in use:${NC}"
    ss -tlnpH "sport = :${BACKEND_PORT}" 2>/dev/null || true
    echo -e "${YELLOW}Try: sudo apt install -y psmisc && fuser -k ${BACKEND_PORT}/tcp${NC}"
    echo -e "${YELLOW}Or:  pm2 stop user-management-backend${NC}"
    exit 1
  fi
fi

echo -e "${GREEN}Ports ${BACKEND_PORT} and ${FRONTEND_PORT} are free.${NC}"
