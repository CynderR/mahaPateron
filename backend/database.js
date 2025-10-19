const sqlite3 = require('sqlite3').verbose();
const path = require('path');

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
        whatsapp_number TEXT,
        patreon_id TEXT,
        mixcloud_id TEXT,
        is_free BOOLEAN DEFAULT 1,
        is_admin BOOLEAN DEFAULT 0,
        patreon_subscription_status TEXT DEFAULT 'unknown',
        last_patreon_sync DATETIME,
        subscription_alert_sent BOOLEAN DEFAULT 0,
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
            
            // Add subscription tracking columns if they don't exist (migration)
            db.run(`ALTER TABLE users ADD COLUMN patreon_subscription_status TEXT DEFAULT 'unknown'`, (err) => {
              if (err && !err.message.includes('duplicate column name')) {
                console.log('patreon_subscription_status column already exists or error:', err.message);
              } else if (!err) {
                console.log('patreon_subscription_status column added successfully');
              }
              
              db.run(`ALTER TABLE users ADD COLUMN last_patreon_sync DATETIME`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                  console.log('last_patreon_sync column already exists or error:', err.message);
                } else if (!err) {
                  console.log('last_patreon_sync column added successfully');
                }
                
                db.run(`ALTER TABLE users ADD COLUMN subscription_alert_sent BOOLEAN DEFAULT 0`, (err) => {
                  if (err && !err.message.includes('duplicate column name')) {
                    console.log('subscription_alert_sent column already exists or error:', err.message);
                  } else if (!err) {
                    console.log('subscription_alert_sent column added successfully');
                  }
                  resolve();
                });
              });
            });
          });
        }
      });
    });
  });
};

// User CRUD operations
const createUser = (userData) => {
  return new Promise((resolve, reject) => {
    const { username, email, password, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin } = userData;
    const sql = `INSERT INTO users (username, email, password, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [username, email, password, whatsapp_number, patreon_id, mixcloud_id, is_free || false, is_admin || false], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, ...userData });
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

const getUserByPatreonId = (patreonId) => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT * FROM users WHERE patreon_id = ?';
    db.get(sql, [patreonId], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    const sql = 'SELECT id, username, email, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin, patreon_subscription_status, last_patreon_sync, subscription_alert_sent, created_at, updated_at FROM users';
    db.all(sql, [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const updateUser = (id, userData) => {
  return new Promise((resolve, reject) => {
    const { username, email, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin, patreon_subscription_status, last_patreon_sync, subscription_alert_sent } = userData;
    const sql = `UPDATE users SET 
                 username = ?, email = ?, whatsapp_number = ?, patreon_id = ?, 
                 mixcloud_id = ?, is_free = ?, is_admin = ?, patreon_subscription_status = ?, 
                 last_patreon_sync = ?, subscription_alert_sent = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`;
    
    db.run(sql, [username, email, whatsapp_number, patreon_id, mixcloud_id, is_free, is_admin, patreon_subscription_status, last_patreon_sync, subscription_alert_sent, id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, ...userData });
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

module.exports = {
  db,
  initDatabase,
  createUser,
  getUserByEmail,
  getUserByUsername,
  getUserById,
  getUserByPatreonId,
  getAllUsers,
  updateUser,
  deleteUser
};


