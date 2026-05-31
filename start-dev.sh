#!/bin/bash

# User Management App - Development Startup Script
# Starts backend (5000) and frontend (3000) for local development.
# Works on Debian without lsof (uses ss/fuser instead).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🚀 Starting User Management App Development Environment..."
echo "=================================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKEND_PORT=5000
FRONTEND_PORT=3000

# Return 0 if something is listening on TCP port $1.
check_port() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnH "sport = :${port}" 2>/dev/null | grep -q .
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -Pi ":${port}" -sTCP:LISTEN -t >/dev/null 2>&1
    return $?
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -tln 2>/dev/null | grep -q ":${port} "
    return $?
  fi
  return 1
}

# Kill whatever is listening on TCP port $1 (no lsof required on Debian).
kill_port() {
  local port="$1"
  echo -e "${YELLOW}🔄 Stopping any existing processes on port ${port}...${NC}"

  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:"${port}" | xargs -r kill -9 2>/dev/null || true
  elif command -v ss >/dev/null 2>&1; then
    local pids
    pids=$(ss -tlnpH "sport = :${port}" 2>/dev/null | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | sort -u)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs -r kill -9 2>/dev/null || true
    fi
  else
    echo -e "${YELLOW}⚠ Install psmisc (fuser) or lsof to free port ${port} automatically${NC}"
  fi

  sleep 1
}

warn_port_still_in_use() {
  local port="$1"
  echo -e "${RED}❌ Port ${port} is still in use.${NC}"
  if command -v ss >/dev/null 2>&1; then
    echo -e "${YELLOW}   Listener:${NC}"
    ss -tlnpH "sport = :${port}" 2>/dev/null || true
  fi
  if [ "$port" = "$BACKEND_PORT" ] && command -v pm2 >/dev/null 2>&1; then
    echo -e "${YELLOW}   If the production backend is running under pm2, stop it first:${NC}"
    echo -e "   pm2 stop user-management-backend"
  fi
  echo -e "${YELLOW}   Or pick another port: PORT=5001 npm run dev${NC} (in backend/)"
}

kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

if check_port "$BACKEND_PORT"; then
  warn_port_still_in_use "$BACKEND_PORT"
  exit 1
fi

echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
if [ ! -d "backend/node_modules" ]; then
  (cd backend && npm install)
fi

echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
if [ ! -d "node_modules" ]; then
  npm install
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

echo -e "${BLUE}🔧 Starting backend server on port ${BACKEND_PORT}...${NC}"
(cd backend && npm run dev) &
BACKEND_PID=$!

sleep 3

if check_port "$BACKEND_PORT"; then
  echo -e "${GREEN}✅ Backend server started on http://localhost:${BACKEND_PORT}${NC}"
else
  echo -e "${RED}❌ Failed to start backend server${NC}"
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 1
fi

echo -e "${BLUE}🎨 Starting frontend server on port ${FRONTEND_PORT}...${NC}"
npm start &
FRONTEND_PID=$!

sleep 5

if check_port "$FRONTEND_PORT"; then
  echo -e "${GREEN}✅ Frontend server started on http://localhost:${FRONTEND_PORT}${NC}"
else
  echo -e "${RED}❌ Failed to start frontend server${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 Development environment is ready!${NC}"
echo "=================================================="
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:${FRONTEND_PORT}"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:${BACKEND_PORT}"
echo -e "${BLUE}🔍 API Health:${NC} http://localhost:${BACKEND_PORT}/api/health"
echo ""
echo -e "${YELLOW}👤 Admin (after create-admin.js):${NC}"
echo -e "   Email: admin@4thstate.ca"
echo -e "   Password: (see backend/create-admin.js)"
echo ""
echo -e "${YELLOW}🛑 To stop:${NC} Press Ctrl+C"
echo "=================================================="

cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  kill_port "$BACKEND_PORT"
  kill_port "$FRONTEND_PORT"
  echo -e "${GREEN}✅ Servers stopped${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

wait
