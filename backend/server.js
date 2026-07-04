const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const {
  initDatabase,
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  updatePassword,
  setPasswordResetToken,
  getUserByResetToken,
  clearPasswordResetToken,
  updateUserFields,
  saveEmailVerificationCode,
  consumeEmailVerificationCode,
  purgeDeletedUserByEmail
} = require('./database');
const { sendEmailVerificationCode, sendPasswordResetEmail } = require('./emailService');

const authenticateToken = require('./middleware/authenticateToken');
const optionalAuthenticateToken = require('./middleware/optionalAuthenticateToken');
const requireAdmin = require('./middleware/requireAdmin');
const authRateLimiter = require('./middleware/authRateLimit');
const { JWT_SECRET } = authenticateToken;
const { validatePassword } = require('./utils/passwordPolicy');
const { ensureDirs, IMAGE_DIR } = require('./config');

const adminUsersRouter = require('./routes/admin-users');
const adminPostsRouter = require('./routes/admin-posts');
const adminLibraryRouter = require('./routes/admin-library');
const accountPlayerRouter = require('./routes/account-player');
const adminRouter = require('./routes/admin');
const accountRouter = require('./routes/account');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const hashVerificationCode = (code) =>
  crypto.createHmac('sha256', JWT_SECRET).update(String(code)).digest('hex');
const generateVerificationCode = () => String(crypto.randomInt(100000, 1000000));
const rssRouter = require('./routes/rss');
const streamRouter = require('./routes/stream');
const shareRouter = require('./routes/share');
const shareOgRouter = require('./routes/shareOg');
const { router: paymentsRouter, webhookHandler } = require('./routes/payments');

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

ensureDirs();

// Middleware
const corsOrigins = CORS_ORIGIN.includes(',')
  ? CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : CORS_ORIGIN;

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// The Stripe webhook must receive the unparsed body so its signature can be
// verified, so it is registered before express.json() consumes the body.
['/api/payments/webhook', '/shyam_akaash/api/payments/webhook'].forEach((p) =>
  app.post(p, express.raw({ type: 'application/json' }), webhookHandler)
);

app.use(express.json());

// Cover art is public so podcast apps can fetch it without auth. Audio is
// never served statically; it only flows through the authenticated /stream
// route which enforces the paying check and supports range requests.
['/uploads/images', '/shyam_akaash/uploads/images'].forEach((p) =>
  app.use(p, express.static(IMAGE_DIR))
);

// ---------------------------------------------------------------------------
// Core auth + profile routes (reused under both the root and subpath prefixes)
// ---------------------------------------------------------------------------
const core = express.Router();

const sanitizeUser = (user) => {
  if (!user) return user;
  const { password, password_reset_token, password_reset_expires, ...rest } = user;
  return rest;
};

core.get('/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

// Send a short-lived verification code before self-service account creation.
core.post('/auth/request-email-verification', authRateLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!username || !normalizedEmail || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existingEmailUser = await getUserByEmail(normalizedEmail);
    if (existingEmailUser && !existingEmailUser.deleted_at) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    if (await getUserByUsername(username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await saveEmailVerificationCode(normalizedEmail, hashVerificationCode(code), expiresAt);

    const emailResult = await sendEmailVerificationCode(normalizedEmail, code);
    if (!emailResult.success) {
      return res.status(500).json({ error: 'Could not send verification email.' });
    }

    res.json({ message: 'Verification code sent. Check your email to finish creating your account.' });
  } catch (error) {
    console.error('Email verification request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register a new self-service account.
core.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { username, email, password, verificationCode } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(verificationCode || '').trim();
    if (!username || !normalizedEmail || !password || !normalizedCode) {
      return res.status(400).json({ error: 'Username, email, password, and verification code are required' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const existingEmailUser = await getUserByEmail(normalizedEmail);
    if (existingEmailUser) {
      if (!existingEmailUser.deleted_at) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      await purgeDeletedUserByEmail(normalizedEmail);
    }
    if (await getUserByUsername(username)) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const verification = await consumeEmailVerificationCode(
      normalizedEmail,
      hashVerificationCode(normalizedCode)
    );
    if (!verification.verified) {
      const errorMessage =
        verification.reason === 'expired'
          ? 'Verification code expired. Please request a new code.'
          : 'Invalid verification code.';
      return res.status(400).json({ error: errorMessage });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await createUser({
      username,
      email: normalizedEmail,
      password: hashedPassword,
      is_free: false,
      is_admin: false
    });

    const created = await getUserById(newUser.id);
    const token = jwt.sign(
      { id: created.id, username: created.username, email: created.email, is_admin: created.is_admin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ message: 'User created successfully', user: sanitizeUser(created), token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login.
core.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await getUserByEmail(email);
    if (!user || user.deleted_at) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const keepSignedIn = rememberMe !== false && rememberMe !== 'false';
    const token = jwt.sign(
      { id: user.id, username: user.username, email: user.email, is_admin: user.is_admin },
      JWT_SECRET,
      { expiresIn: keepSignedIn ? '30d' : '24h' }
    );

    res.json({ message: 'Login successful', user: sanitizeUser(user), token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Current user profile.
core.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(sanitizeUser(user));
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update own profile (username/email only; privileged and billing fields are
// not editable here).
core.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, email } = req.body;
    const data = {};

    if (username !== undefined) {
      const existing = await getUserByUsername(username);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      data.username = username;
    }
    if (email !== undefined) {
      const existing = await getUserByEmail(email);
      if (existing && existing.id !== userId) {
        return res.status(400).json({ error: 'Email already taken' });
      }
      data.email = email;
    }

    await updateUserFields(userId, data);
    const updated = await getUserById(userId);
    res.json({ message: 'Profile updated successfully', user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password.
core.post('/profile/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Current password, new password, and confirmation are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updatePassword(userId, hashedPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password — emails a reset token via the existing email sender.
core.post('/auth/forgot-password', authRateLimiter, async (req, res) => {
  const genericMessage = 'If an account exists with this email, a password reset link has been sent.';
  try {
    const { email } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await getUserByEmail(normalizedEmail);
    if (user && !user.deleted_at) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      await setPasswordResetToken(user.email, resetToken, expiresAt.toISOString());

      const emailResult = await sendPasswordResetEmail(user.email, resetToken);
      if (!emailResult.success) {
        console.error('Failed to send password reset email:', emailResult.error);
      }
    }

    res.json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.json({ message: genericMessage });
  }
});

// Reset password using the emailed token.
core.post('/auth/reset-password', authRateLimiter, async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Token, new password, and confirmation are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation do not match' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const user = await getUserByResetToken(token);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updatePassword(user.id, hashedPassword);
    await clearPasswordResetToken(user.id);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// Mount routers under both the root and the /shyam_akaash subpath so the app
// works whether nginx forwards the prefix or not.
// ---------------------------------------------------------------------------
const API_PREFIXES = ['/api', '/shyam_akaash/api'];
API_PREFIXES.forEach((prefix) => {
  app.use(prefix, core);
  app.use(`${prefix}/share`, optionalAuthenticateToken, shareRouter);
  app.use(`${prefix}/admin/users`, authenticateToken, requireAdmin, adminUsersRouter);
  app.use(`${prefix}/admin/posts`, authenticateToken, requireAdmin, adminPostsRouter);
  app.use(`${prefix}/admin/library`, authenticateToken, requireAdmin, adminLibraryRouter);
  app.use(`${prefix}/admin`, authenticateToken, requireAdmin, adminRouter);
  app.use(`${prefix}/account`, authenticateToken, accountRouter);
  app.use(`${prefix}/account/player`, authenticateToken, accountPlayerRouter);
  app.use(`${prefix}/payments`, authenticateToken, paymentsRouter);
});

// Public RSS and authenticated streaming endpoints (token validated inside).
['', '/shyam_akaash'].forEach((prefix) => {
  app.use(`${prefix}/rss`, rssRouter);
  app.use(`${prefix}/stream`, streamRouter);
  app.use(`${prefix}/og`, shareOgRouter);
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    const server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`\nPort ${PORT} is already in use.`);
        console.error('On this server, stop the production backend first:');
        console.error('  pm2 stop user-management-backend');
        console.error('Or run from the project root:');
        console.error('  ./stop-dev.sh');
        console.error('Then start dev again: ./start-dev.sh\n');
      } else {
        console.error('Server error:', err);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
