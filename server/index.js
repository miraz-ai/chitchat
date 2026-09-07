import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const PORT = 3000;
const JWT_SECRET = 'chitchat_secret_key_123'; // In a real app, use environment variables

app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Helper function to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, JWT_SECRET, { expiresIn: '7d' });
};

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- AUTH ROUTES ---

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'Email already exists' });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const defaultAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';
      
      db.run(
        'INSERT INTO users (name, email, password, avatar, status) VALUES (?, ?, ?, ?, ?)',
        [name, email, hashedPassword, defaultAvatar, 'online'],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          
          const userId = this.lastID;
          const token = generateToken(userId);
          
          res.status(201).json({
            token,
            user: { id: userId, name, email, avatar: defaultAvatar, status: 'online' }
          });
        }
      );
    } catch (hashError) {
      res.status(500).json({ error: 'Error hashing password' });
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

    const token = generateToken(user.id);
    db.run('UPDATE users SET status = ? WHERE id = ?', ['online', user.id]);
    
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar, status: 'online' }
    });
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, avatar, status, last_seen FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  });
});

app.put('/api/auth/profile', authenticateToken, (req, res) => {
  const { name, email, avatar } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  db.run(
    'UPDATE users SET name = ?, email = ?, avatar = ? WHERE id = ?',
    [name, email, avatar, req.user.id],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already in use' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      res.json({
        user: { id: req.user.id, name, email, avatar }
      });
    }
  );
});

// --- USER SEARCH ---
app.get('/api/users/search', authenticateToken, (req, res) => {
  const query = req.query.q || '';
  const searchPattern = `%${query}%`;
  
  const sql = `
    SELECT u.id, u.name, u.email, u.avatar, u.status, u.last_seen,
           c.status as connection_status, c.requester_id
    FROM users u
    LEFT JOIN connections c ON 
      (c.requester_id = u.id AND c.receiver_id = ?) OR 
      (c.requester_id = ? AND c.receiver_id = u.id)
    WHERE u.id != ? AND (u.name LIKE ? OR u.email LIKE ?)
    LIMIT 20
  `;
  
  db.all(sql, [req.user.id, req.user.id, req.user.id, searchPattern, searchPattern], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

// --- CONNECTIONS ---
app.get('/api/connections', authenticateToken, (req, res) => {
  const sql = `
    SELECT c.*, u.id as user_id, u.name, u.avatar, u.status, u.last_seen
    FROM connections c
    JOIN users u ON (c.requester_id = u.id OR c.receiver_id = u.id)
    WHERE (c.requester_id = ? OR c.receiver_id = ?) AND u.id != ?
  `;
  db.all(sql, [req.user.id, req.user.id, req.user.id], (err, connections) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(connections);
  });
});

app.post('/api/connections/request', authenticateToken, (req, res) => {
  const { receiverId } = req.body;
  if (!receiverId || receiverId === req.user.id) {
    return res.status(400).json({ error: 'Invalid receiver' });
  }

  // Check if connection already exists
  db.get('SELECT * FROM connections WHERE (requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)', 
    [req.user.id, receiverId, receiverId, req.user.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) return res.status(400).json({ error: 'Connection already exists or pending' });

      db.run('INSERT INTO connections (requester_id, receiver_id, status) VALUES (?, ?, ?)', 
        [req.user.id, receiverId, 'pending'], function(err) {
          if (err) return res.status(500).json({ error: err.message });
          
          // Emit socket event to receiver if online
          io.to(`user:${receiverId}`).emit('connection:new_request', { id: this.lastID, requester_id: req.user.id });
          
          res.status(201).json({ id: this.lastID, requester_id: req.user.id, receiver_id: receiverId, status: 'pending' });
      });
  });
});

app.post('/api/connections/:id/accept', authenticateToken, (req, res) => {
  const connectionId = req.params.id;
  
  db.get('SELECT * FROM connections WHERE id = ?', [connectionId], (err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!connection) return res.status(404).json({ error: 'Connection not found' });
    if (connection.receiver_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

    db.run('UPDATE connections SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['accepted', connectionId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      io.to(`user:${connection.requester_id}`).emit('connection:accepted', { connectionId });
      res.json({ success: true });
    });
  });
});

// --- CONVERSATIONS ---
app.get('/api/conversations', authenticateToken, (req, res) => {
  const sql = `
    SELECT c.*, 
           (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.status != 'read' AND m.sender_id != ?) as unreadCount,
           (SELECT content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as lastMessage,
           (SELECT created_at FROM messages m3 WHERE m3.conversation_id = c.id ORDER BY m3.created_at DESC LIMIT 1) as lastMessageTimestamp
    FROM conversations c
    JOIN conversation_participants cp ON c.id = cp.conversation_id
    WHERE cp.user_id = ?
    ORDER BY lastMessageTimestamp DESC
  `;
  
  db.all(sql, [req.user.id, req.user.id], (err, conversations) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // For each conversation, we need participants
    const promises = conversations.map(conv => {
      return new Promise((resolve, reject) => {
        db.all(`
          SELECT u.id, u.name, u.avatar, u.status, u.last_seen 
          FROM users u 
          JOIN conversation_participants cp ON u.id = cp.user_id 
          WHERE cp.conversation_id = ?
        `, [conv.id], (err, participants) => {
          if (err) reject(err);
          // Set conversation name/avatar based on the other participant for 1:1
          if (conv.type === 'direct' && participants.length === 2) {
             const other = participants.find(p => p.id !== req.user.id);
             if (other) {
                conv.name = other.name;
                conv.avatar = other.avatar;
             }
          }
          conv.participants = participants;
          resolve(conv);
        });
      });
    });

    Promise.all(promises)
      .then(result => res.json(result))
      .catch(err => res.status(500).json({ error: err.message }));
  });
});

app.post('/api/conversations', authenticateToken, (req, res) => {
  const { userId } = req.body; // other user's id
  
  if (!userId) return res.status(400).json({ error: 'User ID is required' });
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot create conversation with yourself' });

  // Check if 1:1 conversation already exists
  const checkSql = `
    SELECT c.id 
    FROM conversations c
    JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
    JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
    WHERE c.type = 'direct' AND cp1.user_id = ? AND cp2.user_id = ?
  `;
  
  db.get(checkSql, [req.user.id, userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      return res.json({ id: row.id, existing: true }); // already exists
    }

    // Create new
    db.run("INSERT INTO conversations (type) VALUES ('direct')", function(err) {
      if (err) return res.status(500).json({ error: err.message });
      const convId = this.lastID;
      
      db.run("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)", [convId, req.user.id]);
      db.run("INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)", [convId, userId]);
      
      res.status(201).json({ id: convId, type: 'direct' });
    });
  });
});

// --- MESSAGES ---
app.get('/api/conversations/:id/messages', authenticateToken, (req, res) => {
  const conversationId = req.params.id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  
  // Verify user is in conversation
  db.get('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [conversationId, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(403).json({ error: 'Not authorized' });

    db.all(`
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, [conversationId, limit, offset], (err, messages) => {
      if (err) return res.status(500).json({ error: err.message });
      // Return ascending order for chat UI
      res.json(messages.reverse());
    });
  });
});


// --- SOCKET.IO ---

// Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return next(new Error('Authentication error'));
    socket.user = user;
    next();
  });
});

const userSockets = new Map(); // map userId -> set of socketIds

io.on('connection', (socket) => {
  const userId = socket.user.id;
  
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);
  
  // Mark online in DB
  db.run('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', ['online', userId]);
  io.emit('user:status', { userId, status: 'online' });
  
  // Join private room
  socket.join(`user:${userId}`);

  socket.on('disconnect', () => {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        db.run('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', ['offline', userId]);
        io.emit('user:status', { userId, status: 'offline', last_seen: new Date().toISOString() });
      }
    }
  });

  socket.on('conversation:join', (conversationId) => {
    db.get('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [conversationId, userId], (err, row) => {
      if (row) socket.join(`conversation:${conversationId}`);
    });
  });

  socket.on('conversation:leave', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('typing:start', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId });
  });

  socket.on('typing:stop', ({ conversationId }) => {
    socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
  });

  socket.on('message:send', (data, callback) => {
    const { conversationId, content, type = 'text' } = data;
    
    db.get('SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?', [conversationId, userId], (err, row) => {
      if (err || !row) return callback && callback({ error: 'Not authorized' });

      db.run(
        'INSERT INTO messages (conversation_id, sender_id, content, type, status) VALUES (?, ?, ?, ?, ?)',
        [conversationId, userId, content, type, 'sent'],
        function (err) {
          if (err) return callback && callback({ error: err.message });
          
          const msgId = this.lastID;
          db.get('SELECT * FROM messages WHERE id = ?', [msgId], (err, message) => {
             if (message) {
               // Acknowledge back to sender
               if (callback) callback({ message });
               // Broadcast to room (including sender's other devices, but excluding this exact socket to avoid double print if optimistic)
               socket.to(`conversation:${conversationId}`).emit('message:new', message);
             }
          });
        }
      );
    });
  });
  
  socket.on('message:read', ({ messageId, conversationId }) => {
     db.run('UPDATE messages SET status = ?, read_at = CURRENT_TIMESTAMP WHERE id = ? AND status != ?', ['read', messageId, 'read'], (err) => {
       if (!err) {
          io.to(`conversation:${conversationId}`).emit('message:update', { messageId, conversationId, status: 'read' });
       }
     });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
