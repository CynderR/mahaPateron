const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err && !err.message.includes('duplicate column name')) {
        return reject(err);
      }
      resolve(this);
    });
  });

/**
 * Native app entitlements:
 * - app_access: 0/1 — whether the member may use the Capacitor app
 * - offline_use: 'false' | 'true' | days as string (e.g. '14')
 * - episodes_to_keep: NULL = no app-side limit; number = keep N most recent
 * - app_last_authenticated_at: last successful app auth (for offline days window)
 */
const runUserAppAccessMigration = async (db) => {
  await run(db, 'ALTER TABLE users ADD COLUMN app_access INTEGER DEFAULT 0');
  await run(db, "ALTER TABLE users ADD COLUMN offline_use TEXT DEFAULT 'false'");
  await run(db, 'ALTER TABLE users ADD COLUMN episodes_to_keep INTEGER DEFAULT NULL');
  await run(db, 'ALTER TABLE users ADD COLUMN app_last_authenticated_at DATETIME DEFAULT NULL');
};

module.exports = { runUserAppAccessMigration };
