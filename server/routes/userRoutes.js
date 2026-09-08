import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { UserService } from '../services/userService.js';

const router = Router();

/**
 * GET /api/users/search?q=...
 */
router.get('/search', authenticateToken, async (req, res, next) => {
  try {
    const query = req.query.q || '';
    const limit = req.query.limit || 20;
    const users = await UserService.searchUsers(req.user.id, query, limit);
    res.json(users);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/users/:id
 * Only returns private information (like email) if requesting own profile
 */
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId) || targetId <= 0) {
      return res.status(422).json({ error: 'Invalid user ID' });
    }

    const isSelf = req.user.id === targetId;
    const user = await UserService.getUserById(targetId, isSelf);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/users/:id
 * User can edit ONLY their own profile
 */
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId) || targetId <= 0) {
      return res.status(422).json({ error: 'Invalid user ID' });
    }

    if (req.user.id !== targetId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own profile' });
    }

    const { name, email, avatar, bio } = req.body;
    const updatedUser = await UserService.updateProfile(req.user.id, { name, email, avatar, bio });
    res.json({ user: updatedUser });
  } catch (err) {
    next(err);
  }
});

export default router;
