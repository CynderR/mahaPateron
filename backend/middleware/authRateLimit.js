const rateLimit = require('express-rate-limit');

// Throttle credential and recovery endpoints to reduce brute-force and abuse.
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

module.exports = authRateLimiter;
