#!/bin/bash

# User Management App - Development Startup Script
# Starts backend (5000) and frontend (3000) for local development.
# On a server that also runs pm2, run ./stop-dev.sh first (this script calls it).

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
PM2_WAS_STOPPED=0

export BACKEND_PORT FRONTEND_PORT

# Free ports 5000/3000 — stops pm2 production backend and stale nodemon.
if ! bash "$SCRIPT_DIR/stop-dev.sh"; then
  echo -e "${RED}Cannot start dev servers until port ${BACKEND_PORT} is free.${NC}"
  exit 1
fi

# Remember if we stopped pm2 so we can restart it on exit (optional courtesy).
if command -v pm2 >/dev/null 2>&1; then
  if pm2 list 2>/dev/null | grep -q user-management-backend; then
    if pm2 list 2>/dev/null | grep user-management-backend | grep -q stopped; then
      PM2_WAS_STOPPED=1
    fi
  fi
fi

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
  return 1
}

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
echo ""
echo -e "${YELLOW}🛑 To stop dev:${NC} Press Ctrl+C (pm2 production will restart if it was stopped)"
echo "=================================================="

cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down dev servers...${NC}"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  pkill -f "nodemon server.js" 2>/dev/null || true
  bash "$SCRIPT_DIR/stop-dev.sh" >/dev/null 2>&1 || true

  if [ "$PM2_WAS_STOPPED" = "1" ] && command -v pm2 >/dev/null 2>&1; then
    echo -e "${YELLOW}Restarting pm2 production backend...${NC}"
    pm2 start user-management-backend 2>/dev/null || pm2 restart user-management-backend 2>/dev/null || true
  fi

  echo -e "${GREEN}✅ Done${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

wait
