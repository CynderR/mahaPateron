# 🔒 Git Setup Guide - Secure Development

This guide explains how to set up the project for Git while protecting sensitive data.

## 🚨 **IMPORTANT: Before Committing to Git**

### **1. Set Up Environment Variables**

Copy the example environment file and configure it:

```bash
# Copy the example file
cp .env.example .env

# Edit the .env file with your actual values
nano .env  # or use your preferred editor
```

**Required Environment Variables:**
- `JWT_SECRET` - **CRITICAL**: Generate a secure random string for production
  ```bash
  # Generate a secure JWT secret:
  openssl rand -base64 32
  ```
- `PORT` - Server port (default: 5000)
- `DATABASE_URL` - Database file path (default: ./users.db)
- `PATREON_ACCESS_TOKEN` - Your Patreon Creator Access Token (optional)

### **2. Verify .gitignore is Working**

Check that sensitive files are ignored:

```bash
# Check what Git would commit (should NOT show sensitive files)
git status

# Verify these files are ignored:
# - .env
# - users.db
# - *.log files
```

### **3. Initialize Git Repository**

```bash
# Initialize Git repository
git init

# Add all files (sensitive files will be ignored by .gitignore)
git add .

# Make your first commit
git commit -m "Initial commit: User management app with Patreon integration"
```

## 📁 **What's Protected by .gitignore**

### **✅ Files That ARE Committed to Git:**
- Source code (`src/`, `backend/`)
- Configuration files (`package.json`, `tsconfig.json`)
- Documentation (`README.md`, `DEV-SETUP.md`, `GIT-SETUP.md`)
- `.env.example` (template for environment variables)
- `.gitignore` (tells Git what to ignore)

### **❌ Files That Are NOT Committed to Git:**
- `.env` (contains secrets and API keys)
- `users.db` (contains all user data and passwords)
- `node_modules/` (dependencies)
- Log files (`*.log`)
- OS files (`.DS_Store`, `Thumbs.db`)
- IDE files (`.vscode/`, `.idea/`)

## 🔐 **Security Best Practices**

### **Environment Variables:**
- ✅ Use `.env` for local development
- ✅ Use `.env.example` as a template
- ✅ Never commit `.env` to Git
- ✅ Use different secrets for production
- ✅ **JWT_SECRET must be cryptographically secure** (use `openssl rand -base64 32`)

### **Database:**
- ✅ Database file (`users.db`) is ignored by Git
- ✅ User data and passwords are never committed
- ✅ Each developer gets their own local database

### **API Keys:**
- ✅ Patreon access tokens are stored in `.env`
- ✅ Never hardcode API keys in source code
- ✅ Use environment variables for all secrets

## 🚀 **Setting Up on a New Machine**

When someone clones your repository:

```bash
# Clone the repository
git clone <your-repo-url>
cd user-management-app

# Install dependencies
npm run setup

# Copy environment template
cp .env.example .env

# Edit .env with your values
nano .env

# Start development servers
npm run dev
```

## 🔧 **Production Deployment**

For production deployment:

1. **Set environment variables** on your server
2. **Use a secure JWT secret** (generate with: `openssl rand -base64 32`)
3. **Use a production database** (PostgreSQL, MySQL, etc.)
4. **Set CORS_ORIGIN** to your production domain
5. **Use HTTPS** for all communications

## 📋 **Environment Variables Reference**

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-secret-key-change-in-production` | ✅ |
| `PORT` | Server port | `5000` | ❌ |
| `NODE_ENV` | Environment mode | `development` | ❌ |
| `DATABASE_URL` | Database file path | `./users.db` | ❌ |
| `PATREON_ACCESS_TOKEN` | Patreon API token | (empty) | ❌ |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` | ❌ |
| `BCRYPT_ROUNDS` | Password hashing rounds | `10` | ❌ |
| `LOG_LEVEL` | Logging level | `info` | ❌ |

## 🆘 **Troubleshooting**

### **"Database not found" error:**
- Make sure `DATABASE_URL` in `.env` points to the correct path
- The database will be created automatically on first run

### **"JWT secret not set" warning:**
- Set `JWT_SECRET` in your `.env` file
- Generate a secure secret: `openssl rand -base64 32`

### **CORS errors:**
- Update `CORS_ORIGIN` in `.env` to match your frontend URL
- For development: `http://localhost:3000`

### **Patreon API errors:**
- Set `PATREON_ACCESS_TOKEN` in `.env`
- Or configure via the admin dashboard UI

## ✅ **Verification Checklist**

Before pushing to Git, verify:

- [ ] `.env` file exists and is not tracked by Git
- [ ] `users.db` file is not tracked by Git
- [ ] All sensitive data is in environment variables
- [ ] `.env.example` is committed (as a template)
- [ ] `.gitignore` is working correctly
- [ ] App runs successfully with environment variables

---

**🔒 Remember: Never commit sensitive data to Git!**
