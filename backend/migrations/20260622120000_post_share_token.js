const { v4: uuidv4 } = require('uuid');

const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err && !err.message.includes('duplicate column name')) {
        return reject(err);
      }
      resolve(this);
    });
  });

const all = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const tableHasColumn = (db, table, column) =>
  new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${table})`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.some((row) => row.name === column));
    });
  });

const runPostShareTokenMigration = async (db) => {
  const hasColumn = await tableHasColumn(db, 'posts', 'share_token');
  if (!hasColumn) {
    await run(db, 'ALTER TABLE posts ADD COLUMN share_token TEXT');
  }

  await run(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_share_token ON posts(share_token)');

  const missing = await all(
    db,
    `SELECT id FROM posts
     WHERE deleted_at IS NULL AND (share_token IS NULL OR TRIM(share_token) = '')`
  );

  for (const row of missing) {
    await run(db, 'UPDATE posts SET share_token = ? WHERE id = ?', [uuidv4(), row.id]);
  }

  if (missing.length > 0) {
    console.log(`Post share token migration applied (${missing.length} posts backfilled)`);
  }
};

module.exports = { runPostShareTokenMigration };
