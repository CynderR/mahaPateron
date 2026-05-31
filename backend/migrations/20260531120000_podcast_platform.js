// Podcast membership platform migration.
//
// The existing project has no migration tool; schema changes are applied as
// idempotent ALTER TABLE / CREATE TABLE statements at startup (see database.js
// initDatabase). This module follows the same convention and is invoked from
// initDatabase after the base schema is in place.

const { v4: uuidv4 } = require('uuid');

const USER_COLUMNS = [
  'ALTER TABLE users ADD COLUMN whatsapp_id TEXT',
  'ALTER TABLE users ADD COLUMN signal_id TEXT',
  "ALTER TABLE users ADD COLUMN payment_category TEXT DEFAULT 'full'",
  'ALTER TABLE users ADD COLUMN is_paying INTEGER DEFAULT 0',
  "ALTER TABLE users ADD COLUMN access_type TEXT DEFAULT 'both'",
  'ALTER TABLE users ADD COLUMN stripe_customer_id TEXT',
  'ALTER TABLE users ADD COLUMN stripe_sub_id TEXT',
  'ALTER TABLE users ADD COLUMN rss_token TEXT',
  'ALTER TABLE users ADD COLUMN subscription_price REAL',
  'ALTER TABLE users ADD COLUMN deleted_at DATETIME',
];

const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      // Ignore "duplicate column name" so the migration stays idempotent,
      // matching the existing ALTER TABLE pattern in database.js.
      if (err && !err.message.includes('duplicate column name')) {
        return reject(err);
      }
      resolve(this);
    });
  });

const get = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const all = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const runPodcastMigration = async (db) => {
  for (const sql of USER_COLUMNS) {
    await run(db, sql);
  }

  // SQLite cannot add a UNIQUE column via ALTER TABLE, so enforce uniqueness
  // with an index. NULLs are treated as distinct, so existing rows are fine
  // until they are backfilled below.
  await run(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_rss_token ON users(rss_token)');

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      audio_filename TEXT NOT NULL,
      image_filename TEXT,
      duration_secs INTEGER,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      is_published INTEGER DEFAULT 1,
      deleted_at DATETIME
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS platform_settings (
      id INTEGER PRIMARY KEY,
      default_price REAL,
      stripe_price_id TEXT,
      stripe_webhook_secret TEXT
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS stream_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id TEXT,
      user_id INTEGER,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      bytes_sent INTEGER
    )`
  );

  // Ensure the single configuration row exists.
  const settings = await get(db, 'SELECT id FROM platform_settings WHERE id = 1');
  if (!settings) {
    const defaultPrice = parseFloat(process.env.DEFAULT_SUBSCRIPTION_PRICE) || 9.99;
    await run(db, 'INSERT INTO platform_settings (id, default_price) VALUES (1, ?)', [defaultPrice]);
  }

  // Backfill RSS tokens for any pre-existing users.
  const rows = await all(db, "SELECT id FROM users WHERE rss_token IS NULL OR rss_token = ''");
  for (const row of rows) {
    await run(db, 'UPDATE users SET rss_token = ? WHERE id = ?', [uuidv4(), row.id]);
  }

  console.log(`Podcast platform migration applied (${rows.length} RSS tokens backfilled)`);
};

module.exports = { runPodcastMigration };
