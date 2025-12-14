# User Management App

A modern React TypeScript application with a Node.js backend for user management, featuring separate admin and user dashboards.

## Features

- **Landing Page**: Beautiful, responsive landing page with hero section and feature highlights
- **Authentication**: Secure JWT-based authentication with sign-in and sign-up
- **Forgot Password**: Email-based password reset functionality
- **Admin Dashboard**: Complete user management system for administrators
- **User Dashboard**: Personal profile management for regular users
- **Responsive Design**: Modern UI that works on all devices
- **Type Safety**: Full TypeScript implementation

## Tech Stack

### Frontend
- React 19.1.1
- TypeScript
- React Router DOM
- Axios for API calls
- Modern CSS with responsive design

### Backend
- Node.js with Express
- SQLite database
- JWT authentication
- bcryptjs for password hashing
- nodemailer for email sending
- CORS enabled

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Quick Start (Recommended)

Use the automated setup script:

```bash
# Make the script executable (Linux/Mac)
chmod +x start-dev.sh

# Run the setup script
./start-dev.sh
```

Or use npm scripts:

```bash
# Install all dependencies
npm run setup

# Start both backend and frontend
npm run dev
```

### Manual Installation

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Start the backend server:**
   ```bash
   cd backend
   npm start
   ```
   The backend will run on `http://localhost:5000`

4. **Start the frontend development server:**
   ```bash
   npm start
   ```
   The frontend will run on `http://localhost:3000`

## Usage

### Landing Page
- Visit `http://localhost:3000` to see the landing page
- Navigate to sign-in or sign-up from the navigation

### User Registration
- Click "Get Started" or "Sign Up" to create a new account
- Fill in the required fields (username, email, password)
- Optional fields include WhatsApp number, Patreon ID, and Mixcloud ID
- Choose between free or premium account

### User Sign-In
- Use your email and password to sign in
- Click "Forgot password?" to reset your password via email
- You'll be redirected to your personal dashboard

### User Dashboard
- View and edit your profile information
- Update your account details
- See your account statistics

### Admin Dashboard
- Admin users (username: "admin" or email: "admin@example.com") get access to the admin dashboard
- View all registered users
- Edit user information
- Delete users
- See user statistics

## API Endpoints

The backend provides the following endpoints:

- `POST /api/register` - Register a new user
- `POST /api/login` - User login
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Reset password with token
- `GET /api/profile` - Get current user profile
- `PUT /api/profile` - Update current user profile
- `POST /api/profile/change-password` - Change password (authenticated)
- `GET /api/users` - Get all users (authenticated)
- `PUT /api/users/:id` - Update user by ID (authenticated)
- `DELETE /api/users/:id` - Delete user by ID (authenticated)

## Admin Access

To create an admin user, you can either:
1. Register with username "admin" or email "admin@example.com"
2. Or modify the admin check logic in `src/contexts/AuthContext.tsx`

## Project Structure

```
src/
├── components/
│   ├── LandingPage.tsx      # Landing page component
│   ├── SignIn.tsx           # Sign-in form
│   ├── SignUp.tsx           # Sign-up form
│   ├── AdminDashboard.tsx   # Admin dashboard
│   ├── UserDashboard.tsx    # User dashboard
│   ├── ProtectedRoute.tsx   # Route protection
│   ├── LandingPage.css      # Landing page styles
│   ├── Auth.css            # Authentication styles
│   └── Dashboard.css       # Dashboard styles
├── contexts/
│   └── AuthContext.tsx     # Authentication context
├── App.tsx                 # Main app component
└── index.tsx              # App entry point

backend/
├── server.js              # Express server
├── database.js            # Database operations
└── package.json          # Backend dependencies
```

## Customization

### Styling
- Modify CSS files in the `components/` directory to customize the appearance
- The design uses a modern color scheme with blue and yellow accents
- All components are fully responsive

### Admin Logic
- Update the `isAdmin` logic in `AuthContext.tsx` to change admin detection
- Modify the admin dashboard to add or remove features

### User Fields
- Add new user fields by updating the database schema in `backend/database.js`
- Update the sign-up form and dashboards to include new fields

## Security Notes

- Passwords are hashed using bcryptjs
- JWT tokens expire after 24 hours
- CORS is configured for development
- Input validation is implemented on both frontend and backend
- **Environment variables** protect sensitive data (see [GIT-SETUP.md](./GIT-SETUP.md))
- **Database files** are excluded from Git to protect user data

## Development

To run in development mode:
```bash
# Backend with auto-reload
cd backend
npm run dev

# Frontend with hot reload
npm start
```

## Git Setup & Security

**🔒 Important:** Before committing to Git, read the [GIT-SETUP.md](./GIT-SETUP.md) guide to protect sensitive data.

Key points:
- Environment variables protect secrets and API keys
- Database files are excluded from Git
- Use `.env.example` as a template for other developers

## Production Deployment

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Set environment variables for production:
   - `JWT_SECRET` - A secure secret key for JWT signing
   - `PORT` - Server port (default: 5000)
   - `CORS_ORIGIN` - Your production domain
   - `NODE_ENV=production`
   - `FRONTEND_URL` - Your frontend URL (for password reset links)
   - `SMTP_HOST` - SMTP server hostname (e.g., smtp.gmail.com)
   - `SMTP_PORT` - SMTP server port (e.g., 587)
   - `SMTP_SECURE` - Use secure connection (true/false)
   - `SMTP_USER` - SMTP username/email
   - `SMTP_PASS` - SMTP password or app password
   - `SMTP_FROM` - From email address (optional, defaults to SMTP_USER)

3. Deploy the backend and serve the built frontend files

## License

This project is open source and available under the MIT License.