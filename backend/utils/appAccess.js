/**
 * Parse and validate offline_use values.
 * Accepted: 'true' | 'false' | positive integer days (as number or string).
 * Returns normalized string form, or null if invalid.
 */
const normalizeOfflineUse = (value) => {
  if (value === true || value === 1 || value === '1' || value === 'true') return 'true';
  if (value === false || value === 0 || value === '0' || value === 'false' || value == null || value === '') {
    return 'false';
  }
  const days = parseInt(String(value).trim(), 10);
  if (Number.isFinite(days) && days > 0 && String(days) === String(value).trim()) {
    return String(days);
  }
  return null;
};

const normalizeEpisodesToKeep = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 1) return undefined; // signal invalid
  return n;
};

const memberHasAppAccess = (user) => !!(user && (user.app_access === true || user.app_access === 1));

/**
 * Compute offline entitlement snapshot for the app catalog API.
 */
const buildOfflineEntitlement = (user) => {
  const offlineUse = normalizeOfflineUse(user?.offline_use) || 'false';
  const episodesToKeep =
    user?.episodes_to_keep != null && user.episodes_to_keep !== ''
      ? parseInt(user.episodes_to_keep, 10)
      : null;
  const keep =
    Number.isFinite(episodesToKeep) && episodesToKeep > 0 ? episodesToKeep : null;

  let offlineExpiresAt = null;
  let daysRemaining = null;
  let offlineExpired = false;

  if (offlineUse === 'true') {
    // Always offline — no expiry
  } else if (offlineUse === 'false') {
    // Auth required to download; no timed window
  } else {
    const days = parseInt(offlineUse, 10);
    const lastAuth = user?.app_last_authenticated_at
      ? new Date(user.app_last_authenticated_at).getTime()
      : null;
    if (lastAuth && Number.isFinite(lastAuth)) {
      const expires = lastAuth + days * 24 * 60 * 60 * 1000;
      offlineExpiresAt = new Date(expires).toISOString();
      const msLeft = expires - Date.now();
      daysRemaining = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
      offlineExpired = msLeft <= 0;
    } else {
      // No prior app auth recorded — treat as needing auth (window starts on next touch)
      offlineExpired = false;
      daysRemaining = days;
    }
  }

  return {
    app_access: memberHasAppAccess(user),
    offline_use: offlineUse,
    episodes_to_keep: keep,
    app_last_authenticated_at: user?.app_last_authenticated_at || null,
    offline_expires_at: offlineExpiresAt,
    offline_days_remaining: daysRemaining,
    offline_expired: offlineExpired
  };
};

const applyEpisodesToKeep = (posts, keep) => {
  if (keep == null || !Number.isFinite(keep) || keep < 1) return posts;
  return posts.slice(0, keep);
};

module.exports = {
  normalizeOfflineUse,
  normalizeEpisodesToKeep,
  memberHasAppAccess,
  buildOfflineEntitlement,
  applyEpisodesToKeep
};
