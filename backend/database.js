const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { runPodcastMigration } = require('./migrations/20260531120000_podcast_platform');

// Create database connection
// Use environment variable for database path, fallback to default
const dbPath = process.env.DATABASE_URL || path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

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
  }).then(() => runPodcastMigration(db));
};

// User CRUD operations
const createUser = (userData) => {
  return new Promise((resolve, reject) => {
    const {
      username, email, password, is_free, is_admin,
      whatsapp_id, signal_id, payment_category, access_type, subscription_price, is_paying,
      back_catalog_access
    } = userData;
    const rss_token = userData.rss_token || uuidv4();
    const subscribed_at = is_paying ? (userData.subscribed_at || new Date().toISOString()) : null;
    const sql = `INSERT INTO users (
                   username, email, password, is_free, is_admin,
                   whatsapp_id, signal_id, payment_category, access_type, subscription_price,
                   is_paying, rss_token, subscribed_at, back_catalog_access
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(sql, [
      username, email, password, is_free || false, is_admin || false,
      whatsapp_id || null, signal_id || null, payment_category || 'full', access_type || 'both',
      subscription_price != null ? subscription_price : null, is_paying ? 1 : 0, rss_token,
      subscribed_at, back_catalog_access ? 1 : 0
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
  'subscribed_at', 'back_catalog_access'
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
    // Rotate the RSS token so the personal feed stops resolving.
    const sql = `UPDATE users SET deleted_at = CURRENT_TIMESTAMP, rss_token = ? WHERE id = ?`;
    db.run(sql, [uuidv4(), id], function (err) {
      if (err) reject(err);
      else resolve({ deleted: this.changes > 0 });
    });
  });
};

const USER_PUBLIC_COLUMNS = `id, username, email, is_free, is_admin,
  whatsapp_id, signal_id, payment_category, is_paying, access_type,
  stripe_customer_id, stripe_sub_id, subscription_price, rss_token,
  subscribed_at, back_catalog_access, created_at, updated_at`;

const getUsersFiltered = (filters = {}) => {
  return new Promise((resolve, reject) => {
    const { is_paying, payment_category, access_type, includeDeleted = false } = filters;
    const page = Math.max(1, parseInt(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit) || 20));
    const where = [];
    const params = [];

    if (!includeDeleted) where.push('deleted_at IS NULL');
    if (is_paying !== undefined && is_paying !== null && is_paying !== '') {
      where.push('is_paying = ?');
      params.push(is_paying === true || is_paying === 'true' || is_paying === 1 || is_paying === '1' ? 1 : 0);
    }
    if (payment_category) {
      where.push('payment_category = ?');
      params.push(payment_category);
    }
    if (access_type) {
      where.push('access_type = ?');
      params.push(access_type);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    db.all(
      `SELECT ${USER_PUBLIC_COLUMNS} FROM users ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
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
  return new Promise((resolve, reject) => {
    const id = postData.id || uuidv4();
    const { title, description, audio_filename, image_filename, duration_secs, created_by, is_published } = postData;
    const sql = `INSERT INTO posts (id, title, description, audio_filename, image_filename, duration_secs, created_by, is_published)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(sql, [
      id, title, description || null, audio_filename, image_filename || null,
      duration_secs != null ? duration_secs : null, created_by || null,
      is_published === false || is_published === 0 ? 0 : 1
    ], function (err) {
      if (err) reject(err);
      else resolve({ id, ...postData });
    });
  });
};

const getPostById = (id, { includeDeleted = false } = {}) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT * FROM posts WHERE id = ?${includeDeleted ? '' : ' AND deleted_at IS NULL'}`;
    db.get(sql, [id], (err, row) => (err ? reject(err) : resolve(row)));
  });
};

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

const userCanAccessPost = (user, post) => {
  if (!user || !post || !post.is_published || post.deleted_at) return false;
  if (user.back_catalog_access) return true;
  const cutoff = user.subscribed_at || user.created_at;
  if (!cutoff) return true;
  return new Date(post.published_at) >= new Date(cutoff);
};

const getPublishedPostsForUser = (user) => {
  return new Promise((resolve, reject) => {
    if (user.back_catalog_access) {
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

// Set is_paying and stamp subscribed_at when a user (re)activates.
const activateUserSubscription = (id) => {
  return updateUserFields(id, {
    is_paying: 1,
    subscribed_at: new Date().toISOString()
  });
};

const POST_UPDATABLE_FIELDS = ['title', 'description', 'audio_filename', 'image_filename', 'duration_secs', 'is_published'];

const updatePost = (id, data) => {
  return new Promise((resolve, reject) => {
    const keys = Object.keys(data).filter((k) => POST_UPDATABLE_FIELDS.includes(k));
    if (keys.length === 0) {
      return resolve({ id, updated: false });
    }
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => data[k]);
    const sql = `UPDATE posts SET ${setClause} WHERE id = ?`;
    db.run(sql, [...values, id], function (err) {
      if (err) reject(err);
      else resolve({ id, updated: this.changes > 0 });
    });
  });
};

const softDeletePost = (id) => {
  return new Promise((resolve, reject) => {
    db.run('UPDATE posts SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id], function (err) {
      if (err) reject(err);
      else resolve({ deleted: this.changes > 0 });
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
  getUsersFiltered,
  getUserStats,
  createPost,
  getPostById,
  getAllPosts,
  getPublishedPosts,
  getPublishedPostsForUser,
  userCanAccessPost,
  activateUserSubscription,
  updatePost,
  softDeletePost,
  countPosts,
  getPlatformSettings,
  updatePlatformSettings,
  logStreamEvent,
  getStreamStats
};


