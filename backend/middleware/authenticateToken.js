const jwt = require('jsonwebtoken');
const { getUserById } = require('../database');
const { tokenVersionMatches } = require('../utils/secureTokens');

const KNOWN_WEAK_SECRETS = new Set([
  'your-secret-key-change-in-production',
  'your-super-secret-jwt-key-change-this-in-production-USE-OPENSSL-RAND-BASE64-32',
  'dev-only-jwt-secret-not-for-production'
]);

const resolveJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret.length < 32 || KNOWN_WEAK_SECRETS.has(secret)) {
      console.error(
        'FATAL: JWT_SECRET must be set to a unique random string (32+ characters) in production.'
      );
      process.exit(1);
    }
    return secret;
  }

  if (!secret || KNOWN_WEAK_SECRETS.has(secret)) {
    console.warn(
      'WARNING: JWT_SECRET is missing or uses a placeholder. Set a strong JWT_SECRET in backend/.env.'
    );
    return 'dev-only-jwt-secret-not-for-production';
  }

  return secret;
};

const JWT_SECRET = resolveJwtSecret();

// Verifies the JWT Bearer token, checks token_version (invalidated on password change),
// and attaches the decoded payload to req.user.
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);
    if (!user || user.deleted_at || !tokenVersionMatches(user, decoded)) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    res.set('Cache-Control', 'no-store, private');
    res.set('Pragma', 'no-cache');
    res.set('Vary', 'Authorization');
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: !!user.is_admin,
      tv: user.token_version || 0
    };
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authenticateToken;
module.exports.JWT_SECRET = JWT_SECRET;
