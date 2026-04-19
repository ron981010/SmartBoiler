# SmartBoiler EnerApp - Complete Setup Guide

## 🎯 Project Status: FULLY FUNCTIONAL

The application is **READY TO USE** with both frontend and backend running!

## 🚀 Quick Start

### Terminal 1: Start the Angular Frontend (http://localhost:4200)
```bash
cd "c:\Users\Manuel\Documents\GitHub\backup enerapp2"
ng serve --open
```

### Terminal 2: Start the Backend API (http://localhost:3000)
```bash
cd "c:\Users\Manuel\Documents\GitHub\backup enerapp2\backend"
node server.js
```

The app will now be fully functional with:
- ✅ User Registration / Login
- ✅ Dashboard with evaluation history
- ✅ Energy evaluation form with results
- ✅ Save evaluations to SQLite database
- ✅ JWT authentication tokens
- ✅ Password hashing with bcrypt

## 📋 Architecture

### Frontend (Angular 19)
- **Location**: `src/` 
- **Port**: 4200
- **Features**:
  - Login & Signup components with reactive forms
  - Dashboard showing user evaluations
  - Energy evaluation form with multi-screen UI
  - JWT token management with HTTP interceptor
  - Route guards for authentication
  - Responsive design (mobile-friendly)

### Backend (Node.js + Express + SQLite)
- **Location**: `backend/`
- **Port**: 3000
- **Features**:
  - RESTful API with authentication endpoints
  - SQLite database for persistent storage
  - JWT token generation & validation
  - Bcrypt password hashing
  - CORS support for frontend communication

## 🔗 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user

### Evaluations (All require JWT token)
- `GET /api/evaluations` - Get all user evaluations
- `POST /api/evaluations` - Save new evaluation
- `GET /api/evaluations/:id` - Get evaluation details
- `PUT /api/evaluations/:id` - Update evaluation
- `DELETE /api/evaluations/:id` - Delete evaluation

## 🗄️ Database Location
SQLite database file: `backend/database.db`

The database is automatically created on first run with:
- `users` table for user accounts
- `evaluations` table for storing energy evaluations

## 🔐 Security Notes
- Passwords are hashed with bcrypt (10 salt rounds)
- JWT tokens expire after 7 days
- All API endpoints (except login/signup) require valid JWT token
- Tokens are stored in browser localStorage
- Automatic token injection via HTTP interceptor

## 📱 Test Account
After starting both servers:
1. Go to http://localhost:4200
2. Click "Crear Cuenta" (Sign up)
3. Enter any email and password
4. You'll be automatically logged in
5. Click "Nuevo" button to create energy evaluations

## ⚙️ Development Notes
- Frontend: Angular `ng serve` with live reloading
- Backend: `node server.js` (for dev: `npm run dev` for nodemon)
- Both servers can run simultaneously on different ports
- No additional database setup required (SQLite auto-creates tables)

## 🐛 Troubleshooting
If you get `ERR_CONNECTION_REFUSED`:
- Make sure backend is running on port 3000
- Check that database tables were created ("Tables ready" messages should appear)
- Verify CORS is enabled (it is in server.js)

If port 3000 is already in use:
- Edit `server.js` line 5: `const PORT = 3000;` to a different port
- Then update Frontend API URL in `src/app/services/auth.service.ts`

---
**Created**: April 2026  
**Stack**: Angular 19 + Express + SQLite + JWT + Bcrypt
