const path = require('path');
const fs = require('fs');
const mm = require('music-metadata');
const { AUDIO_DIR } = require('../config');
const {
  extractTagsFromMetadata,
  parseMetadataFromDescription,
  buildDescriptionFromTags
} = require('../utils/audioMetadata');

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

const runLibraryAudioMetadataMigration = async (db) => {
  const columns = ['artist TEXT', 'album TEXT', 'year TEXT', 'genre TEXT'];
  for (const column of columns) {
    await run(db, `ALTER TABLE posts ADD COLUMN ${column}`);
    await run(db, `ALTER TABLE library ADD COLUMN ${column}`);
  }

  const posts = await all(
    db,
    `SELECT id, description, audio_filename, artist, album, year, genre FROM posts
     WHERE deleted_at IS NULL
       AND COALESCE(artist, '') = ''
       AND COALESCE(album, '') = ''
       AND COALESCE(year, '') = ''
       AND COALESCE(genre, '') = ''`
  );
  let descriptionBackfill = 0;
  let audioBackfill = 0;

  for (const post of posts) {
    const fromDescription = parseMetadataFromDescription(post.description);
    let tags = {
      artist: post.artist || fromDescription.artist,
      album: post.album || fromDescription.album,
      year: post.year || fromDescription.year,
      genre: post.genre || fromDescription.genre
    };

    const needsAudioParse = !tags.artist && !tags.album && !tags.year && !tags.genre && post.audio_filename;
    if (needsAudioParse) {
      const audioPath = path.join(AUDIO_DIR, post.audio_filename);
      if (fs.existsSync(audioPath)) {
        try {
          const metadata = await mm.parseFile(audioPath);
          tags = extractTagsFromMetadata(metadata);
          audioBackfill += 1;
        } catch (e) {
          console.warn(`Could not parse audio metadata for post ${post.id}:`, e.message);
        }
      }
    } else if (fromDescription.artist || fromDescription.album || fromDescription.year || fromDescription.genre) {
      descriptionBackfill += 1;
    }

    const hasTags = tags.artist || tags.album || tags.year || tags.genre;
    const description =
      post.description?.trim() || (hasTags ? buildDescriptionFromTags(tags, '') : null);

    await run(
      db,
      `UPDATE posts SET artist = ?, album = ?, year = ?, genre = ?, description = COALESCE(description, ?)
       WHERE id = ?`,
      [tags.artist, tags.album, tags.year, tags.genre, description, post.id]
    );
  }

  if (posts.length > 0) {
    await run(
      db,
      `UPDATE library SET
         artist = (SELECT artist FROM posts WHERE posts.id = library.post_id),
         album = (SELECT album FROM posts WHERE posts.id = library.post_id),
         year = (SELECT year FROM posts WHERE posts.id = library.post_id),
         genre = (SELECT genre FROM posts WHERE posts.id = library.post_id)
       WHERE deleted_at IS NULL`
    );
  }

  if (posts.length > 0) {
    console.log(
      `Library audio metadata migration applied (${descriptionBackfill} from description, ${audioBackfill} from audio files)`
    );
  }
};

module.exports = { runLibraryAudioMetadataMigration };
