import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, generateToken } from '../middleware/auth.js';
import { UserService } from '../services/userService.js';

const router = Router();

/**
 * POST /api/auth/register
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, name, email, password } = req.body;
    if (!username || !name || !email || !password) {
      return res.status(422).json({ error: 'All fields (username, name, email, password) are required.' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username.trim())) {
      return res.status(422).json({
        error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores.'
      });
    }

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (password.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSpecial) {
      return res.status(422).json({
        error: 'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim().toLowerCase();

    // Check existing email / username
    const existing = await db.getOne(
      'SELECT id, email, username FROM users WHERE email = ? OR username = ?',
      [trimmedEmail, trimmedUsername]
    );

    if (existing) {
      if (existing.email.toLowerCase() === trimmedEmail) {
        return res.status(409).json({ error: 'An account with this email address already exists.' });
      }
      if (existing.username.toLowerCase() === trimmedUsername) {
        return res.status(409).json({ error: 'This username is already taken. Please choose another.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=random`;

    const result = await db.execute(
      `INSERT INTO users (username, name, email, password, avatar, status, created_at) 
       VALUES (?, ?, ?, ?, ?, 'online', CURRENT_TIMESTAMP)`,
      [trimmedUsername, name.trim(), trimmedEmail, hashedPassword, defaultAvatar]
    );

    const userId = result.lastID;
    const token = generateToken(userId);

    res.status(201).json({
      token,
      user: {
        id: userId,
        username: trimmedUsername,
        name: name.trim(),
        email: trimmedEmail,
        avatar: defaultAvatar,
        status: 'online'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(422).json({ error: 'Email and password are required.' });
    }

    const user = await db.getOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    await db.execute("UPDATE users SET status = 'online' WHERE id = ?", [user.id]);
    const token = generateToken(user.id);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        status: 'online'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req, res, next) => {
  try {
    const user = await UserService.getUserById(req.user.id, true);
    if (!user) {
      return res.status(404).json({ error: 'User profile not found.' });
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, async (req, res, next) => {
  try {
    await UserService.updateStatus(req.user.id, 'offline');
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req, res, next) => {
  try {
    const { name, email, avatar, bio } = req.body;
    const updatedUser = await UserService.updateProfile(req.user.id, { name, email, avatar, bio });
    res.json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
});

export default router;
