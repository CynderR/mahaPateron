@echo off
echo 🚀 Starting User Management App Development Environment...
echo ==================================================

REM Kill any existing processes on our ports
echo 🔄 Stopping any existing processes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo 📦 Installing backend dependencies...
cd backend
if not exist "node_modules" (
    npm install
)

echo 📦 Installing frontend dependencies...
cd ../
if not exist "node_modules" (
    npm install
)

echo ✅ Dependencies installed

echo 🔧 Starting backend server on port 5000...
cd backend
start "Backend Server" cmd /k "npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

echo 🎨 Starting frontend server on port 3000...
cd ../
start "Frontend Server" cmd /k "npm start"

REM Wait a moment for frontend to start
timeout /t 5 /nobreak >nul

echo.
echo 🎉 Development environment is ready!
echo ==================================================
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:5000
echo 🔍 API Health: http://localhost:5000/api/health
echo.
echo 👤 Admin Login:
echo    Email: admin@example.com
echo    Password: admin123
echo.
echo 🛑 To stop servers: Close the command windows
echo ==================================================

pause
