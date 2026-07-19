const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err && !err.message.includes('duplicate column name')) {
        return reject(err);
      }
      resolve(this);
    });
  });

/** Bumps with password changes so existing JWTs become invalid. */
const runUserTokenVersionMigration = async (db) => {
  await run(db, 'ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
};

module.exports = { runUserTokenVersionMigration };
