import db from '../db.js';

export class UserService {
  /**
   * Get user by ID (safe profile: includes email only if includePrivate is true)
   */
  static async getUserById(id, includePrivate = false) {
    const numId = parseInt(id, 10);
    if (isNaN(numId) || numId <= 0) return null;

    const sql = `
      SELECT id, username, name, email, avatar, bio, status, last_seen
      FROM users
      WHERE id = ?
    `;
    const user = await db.getOne(sql, [numId]);
    if (!user) return null;

    if (!includePrivate) {
      const { email, ...publicUser } = user;
      return publicUser;
    }
    return user;
  }

  /**
   * Get raw user by email (includes password hash for auth)
   */
  static async getUserByEmail(email) {
    if (!email) return null;
    return await db.getOne('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  }

  /**
   * Get raw user by username
   */
  static async getUserByUsername(username) {
    if (!username) return null;
    return await db.getOne('SELECT * FROM users WHERE username = ?', [username.trim().toLowerCase()]);
  }

  /**
   * Search users by name, username, or email
   * Returns only safe public information (email is searchable but omitted from results)
   * Computes relationship/connection status with current user
   */
  static async searchUsers(currentUserId, query = '', limit = 20) {
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
    const searchPattern = `%${(query || '').trim()}%`;

    const sql = `
      SELECT u.id, u.username, u.name, u.avatar, u.bio, u.status, u.last_seen,
             c.id AS connection_id,
             CASE
               WHEN c.status = 'accepted' THEN 'connected'
               WHEN c.status = 'pending' AND c.requester_id = ? THEN 'pending'
               WHEN c.status = 'pending' AND c.receiver_id = ? THEN 'incoming_request'
               WHEN c.status = 'rejected' THEN 'rejected'
               ELSE 'not_connected'
             END AS connection_status,
             c.requester_id,
             c.receiver_id
      FROM users u
      LEFT JOIN connections c ON 
        (c.requester_id = u.id AND c.receiver_id = ?) OR 
        (c.requester_id = ? AND c.receiver_id = u.id)
      WHERE u.id != ? AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)
      ORDER BY 
        CASE WHEN c.status = 'accepted' THEN 1 WHEN c.status = 'pending' THEN 2 ELSE 3 END,
        u.name ASC
      LIMIT ?
    `;

    return await db.query(sql, [
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      currentUserId,
      searchPattern,
      searchPattern,
      searchPattern,
      safeLimit
    ]);
  }

  /**
   * Update profile details for a user
   */
  static async updateProfile(userId, { name, email, avatar, bio }) {
    if (!name || !email) {
      const err = new Error('Name and email are required');
      err.statusCode = 422;
      throw err;
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const sanitizedBio = bio !== undefined && bio !== null ? String(bio).trim().slice(0, 300) : null;

    // Check if email is already taken by someone else
    const existing = await db.getOne(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [trimmedEmail, userId]
    );
    if (existing) {
      const err = new Error('Email is already in use by another account');
      err.statusCode = 409;
      throw err;
    }

    await db.execute(
      'UPDATE users SET name = ?, email = ?, avatar = ?, bio = ? WHERE id = ?',
      [trimmedName, trimmedEmail, avatar || null, sanitizedBio, userId]
    );

    return await this.getUserById(userId);
  }

  /**
   * Update user online status
   */
  static async updateStatus(userId, status) {
    const validStatuses = ['online', 'offline', 'away', 'busy'];
    if (!validStatuses.includes(status)) return;

    if (status === 'offline') {
      await db.execute(
        'UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        ['offline', userId]
      );
    } else {
      await db.execute(
        'UPDATE users SET status = ? WHERE id = ?',
        [status, userId]
      );
    }
  }
}

export default UserService;
