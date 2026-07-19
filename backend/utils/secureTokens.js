const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/** One-way hash for secrets stored in the DB (password-reset tokens, etc.). */
const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

const signUserToken = (user, secret, expiresIn) =>
  jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: !!user.is_admin,
      tv: user.token_version || 0
    },
    secret,
    { expiresIn }
  );

const tokenVersionMatches = (user, decoded) =>
  (user.token_version || 0) === (decoded.tv || 0);

module.exports = { hashToken, signUserToken, tokenVersionMatches };
