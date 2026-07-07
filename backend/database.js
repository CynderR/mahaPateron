const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { runPodcastMigration } = require('./migrations/20260531120000_podcast_platform');
const { runPlayerFeaturesMigration } = require('./migrations/20260621120000_player_features');
const { runLibraryAudioMetadataMigration, ensureMetadataColumns, syncLibraryMetadataFromPosts } = require('./migrations/20260617120000_library_audio_metadata');
const { runPostShareTokenMigration } = require('./migrations/20260622120000_post_share_token');
const { runUserDownloadAccessMigration } = require('./migrations/20260624120000_user_download_access');
const { userHasFullCatalogAccess, userHasFullStreamAccess, userIsNotSubscribed } = require('./utils/accessPermissions');

// Create database connection
// Use environment variable for database path, fallback to default
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

let libraryMetadataReady = false;
const ensureLibraryMetadataReady = () => {
  if (libraryMetadataReady) return Promise.resolve();
  return ensureMetadataColumns(db)
    .then(() => syncLibraryMetadataFromPosts(db))
    .then(() => {
      libraryMetadataReady = true;
    });
};

const ensureEmailVerificationTable = () =>
  new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS email_verifications (
        email TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (err) => (err ? reject(err) : resolve())
    );
  });

// Initialize database with users table
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_free BOOLEAN DEFAULT 1,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Users table created successfully');
          
          // Add is_admin column if it doesn't exist (migration)
          db.run(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
              console.log('is_admin column already exists or error:', err.message);
            } else if (!err) {
              console.log('is_admin column added successfully');
            }
            
            // Add password reset token columns if they don't exist (migration)
            db.run(`ALTER TABLE users ADD COLUMN password_reset_token TEXT`, (err) => {
                    if (err && !err.message.includes('duplicate column name')) {
                      console.log('password_reset_token column already exists or error:', err.message);
                    } else if (!err) {
                      console.log('password_reset_token column added successfully');
                    }
                    
                    db.run(`ALTER TABLE users ADD COLUMN password_reset_expires DATETIME`, (err) => {
                      if (err && !err.message.includes('duplicate column name')) {
                        console.log('password_reset_expires column already exists or error:', err.message);
                      } else if (!err) {
                        console.log('password_reset_expires column added successfully');
                      }
                      resolve();
                    });
                  });
          });
        }
      });
    });
  })
    .then(() => runPodcastMigration(db))
    .then(() => runPlayerFeaturesMigration(db))
    .then(() => runLibraryAudioMetadataMigration(db))
    .then(() => runPostShareTokenMigration(db))
    .then(() => runUserDownloadAccessMigration(db))
    .then(() => ensureEmailVerificationTable())
    .then(() => {
      libraryMetadataReady = true;
    });
};

// User CRUD operations
const createUser = (userData) => {
  return new Promise((resolve, reject) => {
    const {
      username, email, password, is_free, is_admin,
      whatsapp_id, signal_id, payment_category, access_type, subscription_price, is_paying,
      back_catalog_access, monthly_payments, download_access
    } = userData;
    const rss_token = userData.rss_token || uuidv4();
    const subscribed_at = is_paying ? (userData.subscribed_at || new Date().toISOString()) : null;
    const sql = `INSERT INTO users (
                   username, email, password, is_free, is_admin,
                   whatsapp_id, signal_id, payment_category, access_type, subscription_price,
                   is_paying, rss_token, subscribed_at, back_catalog_access, monthly_payments,
                   download_access
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
      username, email, password, is_free || false, is_admin || false,
      whatsapp_id || null, signal_id || null, payment_category || 'full', access_type || 'streaming',
      subscription_price != null ? subscription_price : null, is_paying ? 1 : 0, rss_token,
      subscribed_at, back_catalog_access ? 1 : 0,
      monthly_payments === false || monthly_payments === 0 ? 0 : 1,
      download_access ? 1 : 0
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, rss_token, ...userData });
      }
    });
  });
};

const getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE email = ?';
    db.get(sql, [email], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const getUserByUsername = (username) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const getUserById = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE id = ?';
    db.get(sql, [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const updatePassword = (id, hashedPassword) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [hashedPassword, id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, updated: this.changes > 0 });
      }
    });
  });
};

const setPasswordResetToken = (email, token, expiresAt) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE email = ?`;
    db.run(sql, [token, expiresAt, email], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ updated: this.changes > 0 });
      }
    });
  });
};

const getUserByResetToken = (token) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE password_reset_token = ? AND password_reset_expires > datetime("now")';
    db.get(sql, [token], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const clearPasswordResetToken = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?`;
    db.run(sql, [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ updated: this.changes > 0 });
      }
    });
  });
};

const deleteUser = (id) => {
  return new Promise((resolve, reject) => {
    const sql = 'DELETE FROM users WHERE id = ?';
    db.run(sql, [id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ deleted: this.changes > 0 });
      }
    });
  });
};

// ---------------------------------------------------------------------------
// Podcast platform helpers
// ---------------------------------------------------------------------------

const getUserByRssToken = (token) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE rss_token = ? AND deleted_at IS NULL';
    db.get(sql, [token], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

const getUserByStripeCustomerId = (customerId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE stripe_customer_id = ?';
    db.get(sql, [customerId], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

const getUserByStripeSubId = (subId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE stripe_sub_id = ?';
    db.get(sql, [subId], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

const USER_UPDATABLE_FIELDS = [
  'username', 'email', 'is_free', 'is_admin',
  'whatsapp_id', 'signal_id', 'payment_category', 'is_paying', 'access_type',
  'stripe_customer_id', 'stripe_sub_id', 'subscription_price', 'rss_token', 'deleted_at',
  'subscribed_at', 'back_catalog_access', 'monthly_payments', 'download_access'
];

// Dynamic update used by the admin and account routes; only whitelisted
// columns are written.
const updateUserFields = (id, data) => {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(data).filter((k) => USER_UPDATABLE_FIELDS.includes(k));
    if (keys.length === 0) {
      return resolve({ id, updated: false });
    }
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);
    const sql = `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [...values, id], function (err) {
      if (err) reject(err);
      else resolve({ id, updated: this.changes > 0 });
    });
  });
};

const softDeleteUser = (id) => {
  return new Promise((resolve, reject) => {
    // Anonymize unique identifiers and rotate the RSS token so deleted
    // accounts do not block future signups or personal feed access.
    const anonymized = `deleted_user_${id}`;
    const sql = `UPDATE users
                 SET username = ?, email = ?, deleted_at = CURRENT_TIMESTAMP, rss_token = ?
                 WHERE id = ?`;
    db.run(sql, [anonymized, `${anonymized}@deleted.invalid`, uuidv4(), id], function (err) {
      if (err) reject(err);
      else resolve({ deleted: this.changes > 0 });
    });
  });
};

const restoreUser = (id) => {
  return new Promise((resolve, reject) => {
    const sql = `UPDATE users
                 SET deleted_at = NULL, rss_token = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ? AND deleted_at IS NOT NULL`;
    db.run(sql, [uuidv4(), id], function (err) {
      if (err) reject(err);
      else resolve({ restored: this.changes > 0 });
    });
  });
};

const runSql = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

const saveEmailVerificationCode = (email, codeHash, expiresAt) =>
  runSql(
    `INSERT INTO email_verifications (email, code_hash, expires_at, consumed_at)
     VALUES (?, ?, ?, NULL)
     ON CONFLICT(email) DO UPDATE SET
       code_hash = excluded.code_hash,
       expires_at = excluded.expires_at,
       consumed_at = NULL,
       created_at = CURRENT_TIMESTAMP`,
    [String(email || '').trim().toLowerCase(), codeHash, expiresAt]
  );

const consumeEmailVerificationCode = (email, codeHash) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT email, expires_at
       FROM email_verifications
       WHERE email = ? AND code_hash = ? AND consumed_at IS NULL`,
      [normalizedEmail, codeHash],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ verified: false, reason: 'invalid' });
        if (new Date(row.expires_at).getTime() < Date.now()) {
          return resolve({ verified: false, reason: 'expired' });
        }

        db.run(
          'UPDATE email_verifications SET consumed_at = CURRENT_TIMESTAMP WHERE email = ?',
          [normalizedEmail],
          function (updateErr) {
            if (updateErr) return reject(updateErr);
            resolve({ verified: this.changes > 0 });
          }
        );
      }
    );
  });
};

const purgeDeletedUserByEmail = async (email) => {
  const normalizedEmail = String(email || '').trim();
  if (!normalizedEmail) return { deleted: false, reason: 'missing_email' };

  const user = await new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      [normalizedEmail],
      (err, row) => (err ? reject(err) : resolve(row))
    );
  });

  if (!user) return { deleted: false, reason: 'not_found' };
  if (!user.deleted_at) return { deleted: false, reason: 'active_user' };

  await runSql(
    'DELETE FROM playlist_items WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)',
    [user.id]
  );
  await runSql('DELETE FROM playlists WHERE user_id = ?', [user.id]);
  await runSql('DELETE FROM user_favorites WHERE user_id = ?', [user.id]);
  await runSql('DELETE FROM stream_events WHERE user_id = ?', [user.id]);
  const result = await runSql('DELETE FROM users WHERE id = ? AND deleted_at IS NOT NULL', [user.id]);

  return { deleted: result.changes > 0, userId: user.id };
};

const permanentlyDeleteUser = async (id) => {
  await runSql(
    'DELETE FROM playlist_items WHERE playlist_id IN (SELECT id FROM playlists WHERE user_id = ?)',
    [id]
  );
  await runSql('DELETE FROM playlists WHERE user_id = ?', [id]);
  await runSql('DELETE FROM user_favorites WHERE user_id = ?', [id]);
  await runSql('DELETE FROM stream_events WHERE user_id = ?', [id]);
  const result = await runSql('DELETE FROM users WHERE id = ?', [id]);

  return { deleted: result.changes > 0 };
};

const USER_PUBLIC_COLUMNS = `id, username, email, is_free, is_admin,
  whatsapp_id, signal_id, payment_category, is_paying, access_type,
  stripe_customer_id, stripe_sub_id, subscription_price, rss_token,
  subscribed_at, back_catalog_access, monthly_payments, download_access,
  deleted_at, created_at, updated_at`;

const getUsersFiltered = (filters = {}) => {
  return new Promise((resolve, reject) => {
    const {
      is_paying,
      payment_category,
      subscription_status,
      access_type,
      is_admin,
      q,
      account_status = 'active'
    } = filters;
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const where = [];
    const params = [];

    if (account_status === 'deleted') {
      where.push('deleted_at IS NOT NULL');
    } else if (account_status !== 'all') {
      where.push('deleted_at IS NULL');
    }
    if (is_paying !== undefined && is_paying !== null && is_paying !== '') {
      where.push('is_paying = ?');
      params.push(is_paying === true || is_paying === 'true' || is_paying === 1 || is_paying === '1' ? 1 : 0);
    }
    if (payment_category) {
      where.push('payment_category = ?');
      params.push(payment_category);
    }
    if (subscription_status === 'not_subscribed') {
      where.push('payment_category = ?');
      params.push('full');
    } else if (subscription_status === 'subscribed') {
      where.push("payment_category != 'full'");
    }
    if (access_type === 'rss') {
      where.push("(access_type = 'rss' OR access_type = 'both')");
    } else if (access_type) {
      where.push('access_type = ?');
      params.push(access_type);
    }
    if (is_admin !== undefined && is_admin !== null && is_admin !== '') {
      where.push('is_admin = ?');
      params.push(is_admin === true || is_admin === 'true' || is_admin === 1 || is_admin === '1' ? 1 : 0);
    }
    if (q) {
      where.push('(LOWER(username) LIKE ? OR LOWER(email) LIKE ?)');
      const search = `%${String(q).trim().toLowerCase()}%`;
      params.push(search, search);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    db.all(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users ${whereSql} ORDER BY LOWER(username) ASC, id ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      (err, rows) => {
        if (err) return reject(err);
        db.get(`SELECT COUNT(*) AS count FROM users ${whereSql}`, params, (err2, countRow) => {
          if (err2) return reject(err2);
          resolve({ users: rows, total: countRow.count, page, limit });
        });
      }
    );
  });
};

const getUserStats = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_paying = 1 THEN 1 ELSE 0 END) AS paying,
      SUM(CASE WHEN payment_category = 'free' THEN 1 ELSE 0 END) AS free,
      SUM(CASE WHEN is_paying = 1 AND subscription_price IS NOT NULL THEN subscription_price ELSE 0 END) AS paying_override_sum,
      SUM(CASE WHEN is_paying = 1 AND subscription_price IS NULL THEN 1 ELSE 0 END) AS paying_default_count
      FROM users WHERE deleted_at IS NULL`;
    db.get(sql, [], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

// ----- Posts -----

const createPost = (postData) => {
  return ensureLibraryMetadataReady().then(() => new Promise((resolve, reject) => {
    const id = postData.id || uuidv4();
    const {
      title, description, audio_filename, image_filename, duration_secs, created_by, is_published, published_at,
      artist, album, year, genre
    } = postData;
    const published = is_published === false || is_published === 0 ? 0 : 1;
    const publishedAt = published_at || new Date().toISOString();
    const shareToken = postData.share_token || uuidv4();
    const sql = `INSERT INTO posts (
                   id, title, description, audio_filename, image_filename, duration_secs,
                   artist, album, year, genre, created_by, is_published, published_at, share_token
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [
      id, title, description || null, audio_filename, image_filename || null,
      duration_secs != null ? duration_secs : null,
      artist || null, album || null, year || null, genre || null,
      created_by || null, published, publishedAt, shareToken
    ], function (err) {
      if (err) return reject(err);
      getPostById(id)
        .then((post) => syncLibraryFromPost(post))
        .then(() => resolve({ id, ...postData }))
        .catch(reject);
    });
  }));
};

const getPostById = (id, { includeDeleted = false } = {}) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM posts WHERE id = ?${includeDeleted ? '' : ' AND deleted_at IS NULL'}`;
    db.get(sql, [id], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

const getPostByShareToken = (shareToken) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM posts WHERE share_token = ? AND deleted_at IS NULL';
    db.get(sql, [shareToken], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

const getShareTokensForPostIds = (postIds = []) => {
  const ids = [...new Set(postIds.filter(Boolean))];
  if (ids.length === 0) return Promise.resolve({});
  const placeholders = ids.map(() => '?').join(', ');
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, share_token FROM posts WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      ids,
      (err, rows) => {
        if (err) return reject(err);
        const map = {};
        rows.forEach((row) => {
          map[row.id] = row.share_token;
        });
        resolve(map);
      }
    );
  });
};

const ensurePostShareToken = (postId) =>
  getPostById(postId).then((post) => {
    if (!post) return null;
    if (post.share_token) return post.share_token;
    const token = uuidv4();
    return new Promise((resolve, reject) => {
      db.run('UPDATE posts SET share_token = ? WHERE id = ?', [token, postId], (err) => {
        if (err) reject(err);
        else resolve(token);
      });
    });
  });

const getAllPosts = () => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM posts WHERE deleted_at IS NULL ORDER BY published_at DESC';
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

const getPublishedPosts = () => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM posts WHERE deleted_at IS NULL AND is_published = 1 ORDER BY published_at DESC';
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

const DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY = 'discounted';

const userCanAccessPost = (user, post) => {
  if (!user || !post || !post.is_published || post.deleted_at) return false;
  if (userHasFullCatalogAccess(user)) return true;
  const cutoff = user.subscribed_at || user.created_at;
  if (!cutoff) return true;
  return new Date(post.published_at) >= new Date(cutoff);
};

const getPublishedPostsForUser = (user) => {
  return new Promise((resolve, reject) => {
    if (userHasFullCatalogAccess(user)) {
      return getPublishedPosts().then(resolve).catch(reject);
    }
    const cutoff = user.subscribed_at || user.created_at;
    if (!cutoff) {
      return getPublishedPosts().then(resolve).catch(reject);
    }
    const sql = `SELECT * FROM posts
                   WHERE deleted_at IS NULL AND is_published = 1 AND published_at >= ?
                   ORDER BY published_at DESC`;
    db.all(sql, [cutoff], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

const getPostsPaginated = (options = {}) => {
  const { page, limit, sortDir, orderCol, search, offset } = parseLibraryListOptions({
    page: options.page,
    limit: options.limit,
    sortField: options.sortField,
    sortDir: options.sortDir,
    search: options.search
  });

  const where = ['deleted_at IS NULL'];
  const params = [];
  if (options.publishedOnly) {
    where.push('is_published = 1');
  }
  if (options.publishedAfter) {
    where.push('published_at >= ?');
    params.push(options.publishedAfter);
  }
  if (search) {
    where.push(`(
      LOWER(title) LIKE ?
      OR LOWER(COALESCE(description, '')) LIKE ?
    )`);
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM posts ${whereSql} ORDER BY ${orderCol} ${sortDir}, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      (err, rows) => {
        if (err) return reject(err);
        db.get(`SELECT COUNT(*) AS count FROM posts ${whereSql}`, params, (err2, countRow) => {
          if (err2) return reject(err2);
          resolve({ posts: rows, total: countRow.count, page, limit });
        });
      }
    );
  });
};

const getPublishedPostsForUserPaginated = (user, options = {}) => {
  const base = { publishedOnly: true, ...options };
  if (userHasFullCatalogAccess(user)) {
    return getPostsPaginated(base);
  }
  const cutoff = user.subscribed_at || user.created_at;
  if (!cutoff) {
    return getPostsPaginated(base);
  }
  return getPostsPaginated({ ...base, publishedAfter: cutoff });
};

// Set is_paying and stamp subscribed_at on first activation only (not on renewals).
const activateUserSubscription = (id) => {
  return getUserById(id).then((user) => {
    if (!user) return { id, updated: false };
    const updates = { is_paying: 1 };
    if (!user.subscribed_at) {
      updates.subscribed_at = new Date().toISOString();
      updates.back_catalog_access = 1;
    }
    if (userIsNotSubscribed(user)) {
      updates.payment_category = DEFAULT_SUBSCRIBED_PAYMENT_CATEGORY;
    }
    return updateUserFields(id, updates);
  });
};

const POST_UPDATABLE_FIELDS = [
  'title', 'description', 'audio_filename', 'image_filename', 'duration_secs',
  'artist', 'album', 'year', 'genre', 'is_published', 'published_at'
];

const updatePost = (id, data) => {
  return ensureLibraryMetadataReady().then(() => new Promise((resolve, reject) => {
    const keys = Object.keys(data).filter((k) => POST_UPDATABLE_FIELDS.includes(k));
    if (keys.length === 0) {
      return resolve({ id, updated: false });
    }
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);
    const sql = `UPDATE posts SET ${setClause} WHERE id = ?`;
    db.run(sql, [...values, id], function (err) {
      if (err) return reject(err);
      getPostById(id)
        .then((post) => (post ? syncLibraryFromPost(post) : null))
        .then(() => resolve({ id, updated: this.changes > 0 }))
        .catch(reject);
    });
  }));
};

const softDeletePost = (id) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function (err) {
      if (err) return reject(err);
      softDeleteLibraryEntry(id)
        .then(() => resolve({ deleted: this.changes > 0 }))
        .catch(reject);
    });
  });
};

const countPosts = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM posts WHERE deleted_at IS NULL', [], (err, row) =>
      err ? reject(err) : resolve(row.count)
    );
  });
};

// ----- Library (canonical catalog of all episodes) -----

const syncLibraryFromPost = (post) => {
  return ensureLibraryMetadataReady().then(() => new Promise((resolve, reject) => {
    if (!post) return resolve({ synced: false });

    if (post.deleted_at) {
      return softDeleteLibraryEntry(post.id).then(resolve).catch(reject);
    }

    const sql = `INSERT INTO library (
                   id, post_id, title, description, audio_filename, image_filename,
                   duration_secs, artist, album, year, genre,
                   is_published, published_at, updated_at, deleted_at
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL)
                 ON CONFLICT(post_id) DO UPDATE SET
                   title = excluded.title,
                   description = excluded.description,
                   audio_filename = excluded.audio_filename,
                   image_filename = excluded.image_filename,
                   duration_secs = excluded.duration_secs,
                   artist = excluded.artist,
                   album = excluded.album,
                   year = excluded.year,
                   genre = excluded.genre,
                   is_published = excluded.is_published,
                   published_at = excluded.published_at,
                   updated_at = CURRENT_TIMESTAMP,
                   deleted_at = NULL`;

    db.run(sql, [
      post.id,
      post.id,
      post.title,
      post.description || null,
      post.audio_filename,
      post.image_filename || null,
      post.duration_secs != null ? post.duration_secs : null,
      post.artist || null,
      post.album || null,
      post.year || null,
      post.genre || null,
      post.is_published ? 1 : 0,
      post.published_at || new Date().toISOString()
    ], function (err) {
      if (err) reject(err);
      else resolve({ synced: true, id: post.id });
    });
  }));
};

const softDeleteLibraryEntry = (postId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE library SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE post_id = ?',
      [postId],
      function (err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      }
    );
  });
};

const getAllLibraryEntries = () => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM library WHERE deleted_at IS NULL ORDER BY published_at DESC';
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

const getPublishedLibraryEntries = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM library
                 WHERE deleted_at IS NULL AND is_published = 1
                 ORDER BY published_at DESC`;
    db.all(sql, [], (err, rows) => (err ? reject(err) : resolve(rows)));
  });
};

const parseLibraryListOptions = (options = {}) => {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 20));
  const sortField = options.sortField === 'duration' ? 'duration' : 'date';
  const sortDir = options.sortDir === 'asc' ? 'ASC' : 'DESC';
  const orderCol = sortField === 'duration' ? 'duration_secs' : 'published_at';
  const search = (options.search || '').trim();
  return { page, limit, sortDir, orderCol, search, offset: (page - 1) * limit };
};

const applyLibraryMetadataFilters = (where, params, options = {}) => {
  const { artist, album, year, genre } = options;
  if (artist) {
    where.push('artist = ?');
    params.push(artist);
  }
  if (album) {
    where.push('album = ?');
    params.push(album);
  }
  if (year) {
    where.push('year = ?');
    params.push(year);
  }
  if (genre) {
    where.push('genre = ?');
    params.push(genre);
  }
};

const getLibraryEntriesPaginated = (options = {}) => {
  const { page, limit, sortDir, orderCol, search, offset } = parseLibraryListOptions(options);
  const publishedOnly = !!options.publishedOnly;

  const where = ['deleted_at IS NULL'];
  const params = [];
  if (publishedOnly) where.push('is_published = 1');
  if (search) {
    where.push(`(
      LOWER(title) LIKE ?
      OR LOWER(COALESCE(description, '')) LIKE ?
      OR LOWER(COALESCE(artist, '')) LIKE ?
      OR LOWER(COALESCE(album, '')) LIKE ?
      OR LOWER(COALESCE(year, '')) LIKE ?
      OR LOWER(COALESCE(genre, '')) LIKE ?
    )`);
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like, like, like, like);
  }
  applyLibraryMetadataFilters(where, params, options);
  const whereSql = `WHERE ${where.join(' AND ')}`;

  return ensureLibraryMetadataReady().then(() => new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM library ${whereSql} ORDER BY ${orderCol} ${sortDir}, post_id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
      (err, rows) => {
        if (err) return reject(err);
        db.get(`SELECT COUNT(*) AS count FROM library ${whereSql}`, params, (err2, countRow) => {
          if (err2) return reject(err2);
          resolve({ entries: rows, total: countRow.count, page, limit });
        });
      }
    );
  }));
};

const countAllLibraryEntries = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) AS count FROM library WHERE deleted_at IS NULL', [], (err, row) =>
      err ? reject(err) : resolve(row.count)
    );
  });
};

const countPublishedInLibrary = () => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT COUNT(*) AS count FROM library WHERE deleted_at IS NULL AND is_published = 1',
      [],
      (err, row) => (err ? reject(err) : resolve(row.count))
    );
  });
};

const countAccessibleLibraryEntriesForUser = (user) => {
  if (!user) return Promise.resolve(0);
  if (userHasFullCatalogAccess(user)) return countPublishedInLibrary();
  const cutoff = user.subscribed_at || user.created_at;
  if (!cutoff) return countPublishedInLibrary();
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) AS count FROM library
       WHERE deleted_at IS NULL AND is_published = 1 AND published_at >= ?`,
      [cutoff],
      (err, row) => (err ? reject(err) : resolve(row.count))
    );
  });
};

const mapLibraryEntryForUser = (user, entry) => ({
  id: entry.post_id,
  title: entry.title,
  description: entry.description,
  duration_secs: entry.duration_secs,
  published_at: entry.published_at,
  image_filename: entry.image_filename || null,
  artist: entry.artist || null,
  album: entry.album || null,
  year: entry.year || null,
  genre: entry.genre || null,
  accessible: userCanAccessPost(user, entry)
});

const getLibraryMetadataFilters = ({ publishedOnly = false } = {}) => {
  const where = ['deleted_at IS NULL'];
  if (publishedOnly) where.push('is_published = 1');
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const distinctValues = (column) =>
    new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT ${column} AS value FROM library
         ${whereSql} AND ${column} IS NOT NULL AND TRIM(${column}) != ''
         ORDER BY LOWER(${column}) ASC`,
        [],
        (err, rows) => (err ? reject(err) : resolve(rows.map((row) => row.value)))
      );
    });

  return ensureLibraryMetadataReady().then(() =>
    Promise.all([
      distinctValues('artist'),
      distinctValues('album'),
      distinctValues('year'),
      distinctValues('genre')
    ]).then(([artists, albums, years, genres]) => ({ artists, albums, years, genres }))
  );
};

const getLibraryForUser = (user) => {
  return getPublishedLibraryEntries().then((entries) =>
    entries.map((entry) => mapLibraryEntryForUser(user, entry))
  );
};

const getLibraryForUserPaginated = (user, options = {}) => {
  return Promise.all([
    getLibraryEntriesPaginated({ ...options, publishedOnly: true }),
    countPublishedInLibrary(),
    countAccessibleLibraryEntriesForUser(user)
  ]).then(([{ entries, total, page, limit }, catalogTotal, accessible]) => ({
    entries: entries.map((entry) => mapLibraryEntryForUser(user, entry)),
    total,
    catalogTotal,
    accessible,
    page,
    limit
  }));
};

const countLibraryEntries = () => countPublishedInLibrary();

// ----- Platform settings -----

const getPlatformSettings = () => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM platform_settings WHERE id = 1', [], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

const SETTINGS_UPDATABLE_FIELDS = ['default_price', 'stripe_price_id', 'stripe_webhook_secret'];

const updatePlatformSettings = (data) => {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(data).filter((k) => SETTINGS_UPDATABLE_FIELDS.includes(k));
    if (keys.length === 0) {
      return resolve({ updated: false });
    }
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);
    const sql = `UPDATE platform_settings SET ${setClause} WHERE id = 1`;
    db.run(sql, values, function (err) {
      if (err) reject(err);
      else resolve({ updated: this.changes > 0 });
    });
  });
};

// ----- Stream analytics -----

const logStreamEvent = ({ post_id, user_id, bytes_sent }) => {
  return new Promise((resolve, reject) => {
    const sql = 'INSERT INTO stream_events (post_id, user_id, bytes_sent) VALUES (?, ?, ?)';
    db.run(sql, [post_id || null, user_id || null, bytes_sent != null ? bytes_sent : null], function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
};

const getStreamStats = () => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT
      COUNT(*) AS total_streams,
      COALESCE(SUM(p.duration_secs), 0) AS total_duration_secs
      FROM stream_events s LEFT JOIN posts p ON p.id = s.post_id`;
    db.get(sql, [], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

// ----- Favorites & playlists -----

const getUserFavorites = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT post_id, created_at FROM user_favorites WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
};

const addUserFavorite = (userId, postId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT OR IGNORE INTO user_favorites (user_id, post_id) VALUES (?, ?)',
      [userId, postId],
      function (err) {
        if (err) return reject(err);
        resolve({ added: this.changes > 0 });
      }
    );
  });
};

const removeUserFavorite = (userId, postId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM user_favorites WHERE user_id = ? AND post_id = ?',
      [userId, postId],
      function (err) {
        if (err) return reject(err);
        resolve({ removed: this.changes > 0 });
      }
    );
  });
};

const getUserPlaylists = (userId) => {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM playlists WHERE user_id = ? ORDER BY updated_at DESC, name ASC',
      [userId],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
};

const getPlaylistById = (playlistId, userId) => {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM playlists WHERE id = ? AND user_id = ?',
      [playlistId, userId],
      (err, row) => (err ? reject(err) : resolve(row))
    );
  });
};

const createPlaylist = (userId, name) => {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    db.run(
      'INSERT INTO playlists (id, user_id, name) VALUES (?, ?, ?)',
      [id, userId, name],
      function (err) {
        if (err) return reject(err);
        resolve({ id, user_id: userId, name });
      }
    );
  });
};

const deletePlaylist = (playlistId, userId) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DELETE FROM playlist_items WHERE playlist_id = ?', [playlistId]);
      db.run(
        'DELETE FROM playlists WHERE id = ? AND user_id = ?',
        [playlistId, userId],
        function (err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes > 0 });
        }
      );
    });
  });
};

const getPlaylistItems = (playlistId) => {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT
         MIN(pi.id) AS id,
         pi.post_id,
         MIN(pi.position) AS position,
         p.title,
         p.duration_secs,
         p.published_at,
         p.image_filename
       FROM playlist_items pi
       JOIN posts p ON p.id = pi.post_id
       WHERE pi.playlist_id = ? AND p.deleted_at IS NULL
       GROUP BY pi.post_id, p.title, p.duration_secs, p.published_at, p.image_filename
       ORDER BY position ASC`,
      [playlistId],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
};

const addPlaylistItem = (playlistId, postId) => {
  const normalizedPostId = String(postId);
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id FROM playlist_items WHERE playlist_id = ? AND post_id = ? LIMIT 1',
      [playlistId, normalizedPostId],
      (existingErr, existingRow) => {
        if (existingErr) return reject(existingErr);
        if (existingRow) {
          db.run(
            'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [playlistId],
            () => resolve({ added: false, id: existingRow.id })
          );
          return;
        }

    db.get(
      'SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM playlist_items WHERE playlist_id = ?',
      [playlistId],
      (err, row) => {
        if (err) return reject(err);
        const id = uuidv4();
        const position = row?.next_pos ?? 0;
        db.run(
          'INSERT OR IGNORE INTO playlist_items (id, playlist_id, post_id, position) VALUES (?, ?, ?, ?)',
          [id, playlistId, normalizedPostId, position],
          function (insertErr) {
            if (insertErr) return reject(insertErr);
            db.run(
              'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [playlistId],
              () => resolve({ added: this.changes > 0, id })
            );
          }
        );
      }
    );
      }
    );
  });
};

const removePlaylistItem = (playlistId, postId) => {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM playlist_items WHERE playlist_id = ? AND post_id = ?',
      [playlistId, postId],
      function (err) {
        if (err) return reject(err);
        db.run(
          'UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [playlistId],
          () => resolve({ removed: this.changes > 0 })
        );
      }
    );
  });
};

const getLatestAccessiblePostForUser = (user) => {
  return getPublishedPostsForUser(user).then((posts) => posts[0] || null);
};

module.exports = {
  db,
  initDatabase,
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  updatePassword,
  setPasswordResetToken,
  getUserByResetToken,
  clearPasswordResetToken,
  deleteUser,
  // podcast platform
  getUserByRssToken,
  getUserByStripeCustomerId,
  getUserByStripeSubId,
  updateUserFields,
  softDeleteUser,
  restoreUser,
  saveEmailVerificationCode,
  consumeEmailVerificationCode,
  purgeDeletedUserByEmail,
  permanentlyDeleteUser,
  getUsersFiltered,
  getUserStats,
  createPost,
  getPostById,
  getPostByShareToken,
  getShareTokensForPostIds,
  ensurePostShareToken,
  getAllPosts,
  getPublishedPosts,
  getPublishedPostsForUser,
  getPublishedPostsForUserPaginated,
  getPostsPaginated,
  userCanAccessPost,
  activateUserSubscription,
  updatePost,
  softDeletePost,
  countPosts,
  syncLibraryFromPost,
  getAllLibraryEntries,
  getPublishedLibraryEntries,
  getLibraryEntriesPaginated,
  getLibraryMetadataFilters,
  getLibraryForUser,
  getLibraryForUserPaginated,
  countAllLibraryEntries,
  countPublishedInLibrary,
  countAccessibleLibraryEntriesForUser,
  countLibraryEntries,
  getPlatformSettings,
  updatePlatformSettings,
  logStreamEvent,
  getStreamStats,
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  getUserPlaylists,
  getPlaylistById,
  createPlaylist,
  deletePlaylist,
  getPlaylistItems,
  addPlaylistItem,
  removePlaylistItem,
  getLatestAccessiblePostForUser
};


