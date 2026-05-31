// Requires that the authenticated user is an admin. Must run after
// authenticateToken so req.user is populated. Admin access continues to use
// the existing is_admin boolean rather than a separate role enum.
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = requireAdmin;
