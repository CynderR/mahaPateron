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
  "ALTER TABLE users ADD COLUMN access_type TEXT DEFAULT 'streaming'",
  'ALTER TABLE users ADD COLUMN stripe_customer_id TEXT',
  'ALTER TABLE users ADD COLUMN stripe_sub_id TEXT',
  'ALTER TABLE users ADD COLUMN rss_token TEXT',
  'ALTER TABLE users ADD COLUMN subscription_price REAL',
  'ALTER TABLE users ADD COLUMN deleted_at DATETIME',
  'ALTER TABLE users ADD COLUMN subscribed_at DATETIME',
  'ALTER TABLE users ADD COLUMN back_catalog_access INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN monthly_payments INTEGER DEFAULT 1',
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

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS library (
      id TEXT PRIMARY KEY,
      post_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      audio_filename TEXT NOT NULL,
      image_filename TEXT,
      duration_secs INTEGER,
      is_published INTEGER DEFAULT 1,
      published_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    )`
  );

  // Keep the library catalog in sync with every post. SQLite only allows
  // ON CONFLICT with INSERT ... VALUES, not INSERT ... SELECT.
  const posts = await all(db, 'SELECT * FROM posts');
  const upsertLibrarySql = `INSERT INTO library (
       id, post_id, title, description, audio_filename, image_filename,
       duration_secs, is_published, published_at, updated_at, deleted_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(post_id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       audio_filename = excluded.audio_filename,
       image_filename = excluded.image_filename,
       duration_secs = excluded.duration_secs,
       is_published = excluded.is_published,
       published_at = excluded.published_at,
       updated_at = CURRENT_TIMESTAMP,
       deleted_at = excluded.deleted_at`;

  for (const post of posts) {
    await run(db, upsertLibrarySql, [
      post.id,
      post.id,
      post.title,
      post.description || null,
      post.audio_filename,
      post.image_filename || null,
      post.duration_secs != null ? post.duration_secs : null,
      post.is_published ? 1 : 0,
      post.published_at || null,
      post.deleted_at || null,
    ]);
  }

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

  // Backfill subscription start and archive access for users who existed before
  // these columns were added. Only runs while subscribed_at is still NULL.
  const legacyPaying = await all(
    db,
    'SELECT id FROM users WHERE is_paying = 1 AND subscribed_at IS NULL'
  );
  if (legacyPaying.length > 0) {
    await run(
      db,
      `UPDATE users SET subscribed_at = created_at
       WHERE subscribed_at IS NULL AND is_paying = 1`
    );
    for (const row of legacyPaying) {
      await run(db, 'UPDATE users SET back_catalog_access = 1 WHERE id = ?', [row.id]);
    }
  }

  // Comped / manual-payment users are not on Stripe monthly billing.
  await run(
    db,
    `UPDATE users SET monthly_payments = 0
     WHERE payment_category IN ('free', 'non_card')`
  );

  console.log(`Podcast platform migration applied (${rows.length} RSS tokens backfilled)`);
};

module.exports = { runPodcastMigration };
