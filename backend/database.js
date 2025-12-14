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
        is_mixcloud BOOLEAN DEFAULT 0,
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
                      
                      // Migration: Convert mixcloud_id to is_mixcloud
                      // First check if mixcloud_id column exists
                      db.all("PRAGMA table_info(users)", (err, columns) => {
                        if (err) {
                          console.log('Error checking table info:', err.message);
                          resolve();
                          return;
                        }
                        
                        const hasMixcloudId = columns.some(col => col.name === 'mixcloud_id');
                        const hasIsMixcloud = columns.some(col => col.name === 'is_mixcloud');
                        
                        if (hasMixcloudId && !hasIsMixcloud) {
                          // Add is_mixcloud column
                          db.run(`ALTER TABLE users ADD COLUMN is_mixcloud BOOLEAN DEFAULT 0`, (err) => {
                            if (err && !err.message.includes('duplicate column name')) {
                              console.log('is_mixcloud column already exists or error:', err.message);
                            } else if (!err) {
                              console.log('is_mixcloud column added successfully');
                              
                              // Migrate data: set is_mixcloud to 1 where mixcloud_id is not null
                              db.run(`UPDATE users SET is_mixcloud = 1 WHERE mixcloud_id IS NOT NULL AND mixcloud_id != ''`, (err) => {
                                if (err) {
                                  console.log('Error migrating mixcloud data:', err.message);
                                } else {
                                  console.log('Migrated mixcloud_id to is_mixcloud');
                                }
                                resolve();
                              });
                            } else {
                              resolve();
                            }
                          });
                        } else if (!hasIsMixcloud) {
                          // Add is_mixcloud if it doesn't exist
                          db.run(`ALTER TABLE users ADD COLUMN is_mixcloud BOOLEAN DEFAULT 0`, (err) => {
                            if (err && !err.message.includes('duplicate column name')) {
                              console.log('is_mixcloud column already exists or error:', err.message);
                            } else if (!err) {
                              console.log('is_mixcloud column added successfully');
                            }
                            resolve();
                          });
                        } else {
                          resolve();
                        }
                      });
                    });
                  });
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
    const { username, email, password, whatsapp_number, patreon_id, is_mixcloud, is_free, is_admin } = userData;
    const sql = `INSERT INTO users (username, email, password, whatsapp_number, patreon_id, is_mixcloud, is_free, is_admin) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [username, email, password, whatsapp_number, patreon_id, is_mixcloud || false, is_free || false, is_admin || false], function(err) {
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
    const sql = 'SELECT id, username, email, whatsapp_number, patreon_id, is_mixcloud, is_free, is_admin, patreon_subscription_status, last_patreon_sync, subscription_alert_sent, created_at, updated_at FROM users';
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
    const { username, email, whatsapp_number, patreon_id, is_mixcloud, is_free, is_admin, patreon_subscription_status, last_patreon_sync, subscription_alert_sent } = userData;
    const sql = `UPDATE users SET 
                 username = ?, email = ?, whatsapp_number = ?, patreon_id = ?, 
                 is_mixcloud = ?, is_free = ?, is_admin = ?, patreon_subscription_status = ?, 
                 last_patreon_sync = ?, subscription_alert_sent = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`;
    
    db.run(sql, [username, email, whatsapp_number, patreon_id, is_mixcloud || false, is_free, is_admin, patreon_subscription_status, last_patreon_sync, subscription_alert_sent, id], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, ...userData });
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
  updatePassword,
  setPasswordResetToken,
  getUserByResetToken,
  clearPasswordResetToken,
  deleteUser
};


