#!/bin/bash

# User Management App - Development Startup Script
# This script starts both the backend and frontend servers for development

echo "🚀 Starting User Management App Development Environment..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        return 0
    else
        return 1
    fi
}

# Function to kill processes on specific ports
kill_port() {
    echo -e "${YELLOW}🔄 Stopping any existing processes on port $1...${NC}"
    lsof -ti:$1 | xargs kill -9 2>/dev/null || true
}

# Kill existing processes on our ports
kill_port 5000
kill_port 3000

echo -e "${BLUE}📦 Installing backend dependencies...${NC}"
cd backend
if [ ! -d "node_modules" ]; then
    npm install
fi

echo -e "${BLUE}📦 Installing frontend dependencies...${NC}"
cd ../src
cd ../
if [ ! -d "node_modules" ]; then
    npm install
fi

echo -e "${GREEN}✅ Dependencies installed${NC}"

# Start backend server
echo -e "${BLUE}🔧 Starting backend server on port 5000...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Check if backend started successfully
if check_port 5000; then
    echo -e "${GREEN}✅ Backend server started successfully on http://localhost:5000${NC}"
else
    echo -e "${RED}❌ Failed to start backend server${NC}"
    exit 1
fi

# Start frontend server
echo -e "${BLUE}🎨 Starting frontend server on port 3000...${NC}"
cd ../
npm start &
FRONTEND_PID=$!

# Wait a moment for frontend to start
sleep 5

# Check if frontend started successfully
if check_port 3000; then
    echo -e "${GREEN}✅ Frontend server started successfully on http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Failed to start frontend server${NC}"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

echo ""
echo -e "${GREEN}🎉 Development environment is ready!${NC}"
echo "=================================================="
echo -e "${BLUE}📱 Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}🔧 Backend API:${NC} http://localhost:5000"
echo -e "${BLUE}🔍 API Health:${NC} http://localhost:5000/api/health"
echo ""
echo -e "${YELLOW}👤 Admin Login:${NC}"
echo -e "   Email: admin@example.com"
echo -e "   Password: admin123"
echo ""
echo -e "${YELLOW}🛑 To stop servers:${NC} Press Ctrl+C"
echo "=================================================="

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    kill_port 5000
    kill_port 3000
    echo -e "${GREEN}✅ Servers stopped${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for user to stop
wait
