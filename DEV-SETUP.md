# 🚀 Development Setup Guide

This guide will help you quickly start the User Management App development environment.

## Quick Start

### Option 1: Using the Development Script (Recommended)

**Linux/Mac:**
```bash
./start-dev.sh
```

**Windows:**
```cmd
start-dev.bat
```

### Option 2: Using npm Scripts

**First time setup:**
```bash
npm run setup
```

**Start development servers:**
```bash
npm run dev
```

### Option 3: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm install
npm run dev  # Uses nodemon for auto-restart
```

**Terminal 2 - Frontend:**
```bash
npm install
npm start
```

## 🌐 Access Points

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/api/health

## 👤 Test Credentials

**Admin User:**
- Email: `admin@example.com`
- Password: `admin123`

**Regular User:**
- Create a new account via the signup page

## 🛠️ Available Scripts

- `npm run dev` - Start both backend and frontend
- `npm run backend` - Start only backend server (with auto-restart)
- `npm run frontend` - Start only frontend server
- `npm run setup` - Install all dependencies
- `npm start` - Start frontend only (default React script)

## 🔧 Development Features

### Backend (Port 5000)
- Express.js server with SQLite database
- JWT authentication
- Admin role management
- RESTful API endpoints
- **Auto-restart with nodemon** - Automatically restarts when code changes

### Frontend (Port 3000)
- React with TypeScript
- React Router for navigation
- Axios for API calls
- Role-based access control

## 🛑 Stopping Servers

- **Script method:** Press `Ctrl+C`
- **Manual method:** Close terminal windows
- **Windows batch:** Close command windows

## 🐛 Troubleshooting

**Port already in use:**
- The scripts automatically kill existing processes on ports 3000 and 5000
- If issues persist, manually kill processes: `lsof -ti:3000 | xargs kill -9`

**Dependencies issues:**
- Run `npm run setup` to reinstall all dependencies
- Delete `node_modules` folders and reinstall if needed

**Database issues:**
- The SQLite database is automatically created in `backend/users.db`
- Delete the database file to reset all data

## 📁 Project Structure

```
user-management-app/
├── backend/           # Express.js API server
│   ├── server.js     # Main server file
│   ├── database.js   # SQLite database operations
│   └── users.db      # SQLite database (auto-created)
├── src/              # React frontend
│   ├── components/   # React components
│   ├── contexts/     # React contexts (Auth)
│   └── App.tsx       # Main app component
├── start-dev.sh      # Linux/Mac development script
├── start-dev.bat     # Windows development script
└── package.json      # Frontend dependencies and scripts
```
