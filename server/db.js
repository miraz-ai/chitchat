import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database', err.message);
  } else {
    console.log('Connected to SQLite database');
    db.all("PRAGMA table_info(users)", (err, columns) => {
      let hasUsername = false;
      if (columns) {
         hasUsername = columns.some(col => col.name === 'username');
      }
      
      if (!hasUsername && columns && columns.length > 0) {
        console.log("Migrating users table to add 'username' column...");
        db.serialize(() => {
          db.run(`CREATE TABLE IF NOT EXISTS users_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            status TEXT DEFAULT 'offline',
            last_seen DATETIME
          )`);
          
          db.run(`INSERT INTO users_new (id, username, name, email, password, avatar)
                  SELECT id, LOWER(REPLACE(name, ' ', '_')) || '_' || id, name, email, password, avatar FROM users`);
          
          db.run(`DROP TABLE users`);
          db.run(`ALTER TABLE users_new RENAME TO users`);
        });
      } else {
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            status TEXT DEFAULT 'offline',
            last_seen DATETIME
          )
        `);
      }
    });

    // Enable foreign keys
    db.run("PRAGMA foreign_keys = ON;");

    // Connections table
    db.run(`
      CREATE TABLE IF NOT EXISTS connections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        requester_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(requester_id, receiver_id)
      )
    `);

    // Conversations table
    db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'direct', -- 'direct', 'group'
        name TEXT,
        direct_key TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Conversation Participants table
    db.run(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        is_pinned BOOLEAN DEFAULT 0,
        is_muted BOOLEAN DEFAULT 0,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(conversation_id, user_id)
      )
    `);

    // Messages table
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        sender_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
        is_pinned BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered_at DATETIME,
        read_at DATETIME,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Performance & Integrity Indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_connections_users ON connections (requester_id, receiver_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_connections_receiver ON connections (receiver_id, status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants (user_id, conversation_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants (conversation_id, user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_search ON users (username, name, email)`);

    // Column migrations for existing tables
    db.all("PRAGMA table_info(conversation_participants)", (err, cols) => {
      if (cols) {
        if (!cols.some(c => c.name === 'is_pinned')) {
          db.run("ALTER TABLE conversation_participants ADD COLUMN is_pinned BOOLEAN DEFAULT 0");
        }
        if (!cols.some(c => c.name === 'is_muted')) {
          db.run("ALTER TABLE conversation_participants ADD COLUMN is_muted BOOLEAN DEFAULT 0");
        }
      }
    });

    db.all("PRAGMA table_info(messages)", (err, cols) => {
      if (cols) {
        if (!cols.some(c => c.name === 'is_pinned')) {
          db.run("ALTER TABLE messages ADD COLUMN is_pinned BOOLEAN DEFAULT 0");
        }
        if (!cols.some(c => c.name === 'is_edited')) {
          db.run("ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT 0");
        }
        if (!cols.some(c => c.name === 'updated_at')) {
          db.run("ALTER TABLE messages ADD COLUMN updated_at DATETIME");
        }
      }
    });

    db.all("PRAGMA table_info(users)", (err, cols) => {
      if (cols) {
        if (!cols.some(c => c.name === 'bio')) {
          db.run("ALTER TABLE users ADD COLUMN bio TEXT");
        }
        if (!cols.some(c => c.name === 'created_at')) {
          db.run("ALTER TABLE users ADD COLUMN created_at DATETIME");
        }
      }
    });

    db.all("PRAGMA table_info(conversations)", (err, cols) => {
      if (cols) {
        if (!cols.some(c => c.name === 'direct_key')) {
          db.run("ALTER TABLE conversations ADD COLUMN direct_key TEXT", () => {
            db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_key ON conversations (direct_key)");
            db.all("SELECT id FROM conversations WHERE type = 'direct' AND direct_key IS NULL", (err, rows) => {
              if (rows) {
                rows.forEach(r => {
                  db.all("SELECT user_id FROM conversation_participants WHERE conversation_id = ? ORDER BY user_id ASC", [r.id], (err, pRows) => {
                    if (pRows && pRows.length === 2) {
                      const key = `${pRows[0].user_id}_${pRows[1].user_id}`;
                      db.run("UPDATE conversations SET direct_key = ? WHERE id = ?", [key, r.id]);
                    }
                  });
                });
              }
            });
          });
        } else {
          db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_direct_key ON conversations (direct_key)");
        }
      }
    });
  }
});

// Promise-based wrappers for async/await service layers
db.query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

db.getOne = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

db.execute = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export default db;
