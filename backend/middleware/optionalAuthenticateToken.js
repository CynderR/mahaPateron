const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./authenticateToken');
const { getUserById } = require('../database');
const { tokenVersionMatches } = require('../utils/secureTokens');

/** Attach full user to req.authenticatedUser when a valid JWT is present; never rejects. */
const optionalAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await getUserById(decoded.id);
    if (user && !user.deleted_at && tokenVersionMatches(user, decoded)) {
      req.authenticatedUser = user;
    }
  } catch {
    // Ignore invalid tokens for optional auth.
  }
  return next();
};

module.exports = optionalAuthenticateToken;
