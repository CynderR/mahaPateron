const {
  parseMetadataFromDescription,
  buildDescriptionFromTags
} = require('../utils/audioMetadata');

const METADATA_COLUMNS = ['artist', 'album', 'year', 'genre'];

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

const ensureMetadataColumns = async (db) => {
  for (const column of METADATA_COLUMNS) {
    const onPosts = await tableHasColumn(db, 'posts', column);
    if (!onPosts) {
      await run(db, `ALTER TABLE posts ADD COLUMN ${column} TEXT`);
    }
    const onLibrary = await tableHasColumn(db, 'library', column);
    if (!onLibrary) {
      await run(db, `ALTER TABLE library ADD COLUMN ${column} TEXT`);
    }
  }
};

const syncLibraryMetadataFromPosts = (db) =>
  run(
    db,
    `UPDATE library SET
       artist = (SELECT artist FROM posts WHERE posts.id = library.post_id),
       album = (SELECT album FROM posts WHERE posts.id = library.post_id),
       year = (SELECT year FROM posts WHERE posts.id = library.post_id),
       genre = (SELECT genre FROM posts WHERE posts.id = library.post_id)
     WHERE deleted_at IS NULL`
  );

const backfillPostMetadataFromDescription = async (db) => {
  const posts = await all(
    db,
    `SELECT id, description, artist, album, year, genre FROM posts
     WHERE deleted_at IS NULL
       AND COALESCE(artist, '') = ''
       AND COALESCE(album, '') = ''
       AND COALESCE(year, '') = ''
       AND COALESCE(genre, '') = ''`
  );

  let updated = 0;
  for (const post of posts) {
    const tags = parseMetadataFromDescription(post.description);
    if (!tags.artist && !tags.album && !tags.year && !tags.genre) continue;

    const description = post.description?.trim() || buildDescriptionFromTags(tags, '');
    await run(
      db,
      `UPDATE posts
       SET artist = ?, album = ?, year = ?, genre = ?, description = COALESCE(description, ?)
       WHERE id = ?`,
      [tags.artist, tags.album, tags.year, tags.genre, description, post.id]
    );
    updated += 1;
  }
  return updated;
};

const runLibraryAudioMetadataMigration = async (db) => {
  await ensureMetadataColumns(db);
  const updated = await backfillPostMetadataFromDescription(db);
  await syncLibraryMetadataFromPosts(db);

  if (updated > 0) {
    console.log(`Library audio metadata migration applied (${updated} posts backfilled from description)`);
  }
};

module.exports = {
  runLibraryAudioMetadataMigration,
  ensureMetadataColumns,
  syncLibraryMetadataFromPosts
};
