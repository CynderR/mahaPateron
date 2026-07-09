const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err && !err.message.includes('duplicate column name')) {
        return reject(err);
      }
      resolve(this);
    });
  });

const runUserUnsubscribedAtMigration = async (db) => {
  await run(db, 'ALTER TABLE users ADD COLUMN unsubscribed_at TEXT');

  // Stamp existing inactive subscribers so frozen RSS can exclude post-unsubscribe episodes.
  await run(
    db,
    `UPDATE users
     SET unsubscribed_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
     WHERE is_paying = 0
       AND payment_category = 'full'
       AND unsubscribed_at IS NULL`
  );
};

module.exports = { runUserUnsubscribedAtMigration };
