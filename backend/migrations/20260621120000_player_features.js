const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err && !err.message.includes('duplicate column name')) {
        return reject(err);
      }
      resolve(this);
    });
  });

const runPlayerFeaturesMigration = async (db) => {
  await run(
    db,
    `CREATE TABLE IF NOT EXISTS user_favorites (
      user_id INTEGER NOT NULL,
      post_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await run(
    db,
    `CREATE TABLE IF NOT EXISTS playlist_items (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL,
      post_id TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(playlist_id, post_id)
    )`
  );

  await run(db, 'CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id)');
  await run(db, 'CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id)');
};

module.exports = { runPlayerFeaturesMigration };
