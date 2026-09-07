import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from './db.js';

const app = express();
const PORT = 3000;
const JWT_SECRET = 'chitchat_secret_key_123'; // In a real app, use environment variables

app.use(cors());
app.use(express.json());

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

// --- Routes ---

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if user exists
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) return res.status(400).json({ error: 'Email already exists' });

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const defaultAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=random';
      
      db.run(
        'INSERT INTO users (name, email, password, avatar) VALUES (?, ?, ?, ?)',
        [name, email, hashedPassword, defaultAvatar],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          
          const userId = this.lastID;
          const token = generateToken(userId);
          
          res.status(201).json({
            token,
            user: { id: userId, name, email, avatar: defaultAvatar }
          });
        }
      );
    } catch (hashError) {
      res.status(500).json({ error: 'Error hashing password' });
    }
  });
});

// Login
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
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, avatar: user.avatar }
    });
  });
});

// Get Current User
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, avatar FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  });
});

// Update Profile
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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
