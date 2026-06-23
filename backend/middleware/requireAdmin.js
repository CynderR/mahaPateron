const { getUserById } = require('../database');

// Requires that the authenticated user is an admin. Re-checks the database so
// demoted admins lose access immediately instead of when their JWT expires.
const requireAdmin = async (req, res, next) => {
  if (!req.user?.id) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const user = await getUserById(req.user.id);
    if (!user || user.deleted_at || !user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = {
      ...req.user,
      is_admin: true
    };
    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = requireAdmin;
