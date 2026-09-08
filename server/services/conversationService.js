import db from '../db.js';

export class ConversationService {
  /**
   * Check if a user is a participant in a conversation
   */
  static async isParticipant(conversationId, userId) {
    const row = await db.getOne(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
      [conversationId, userId]
    );
    return !!row;
  }

  /**
   * Get all conversations for a user with unread counts and participants
   */
  static async getUserConversations(userId) {
    const sql = `
      SELECT c.*, 
             cp.is_pinned,
             cp.is_muted,
             (SELECT COUNT(*) 
              FROM messages m 
              WHERE m.conversation_id = c.id 
                AND m.status != 'read' 
                AND m.sender_id != ?) AS unreadCount,
             (SELECT content 
              FROM messages m2 
              WHERE m2.conversation_id = c.id 
              ORDER BY m2.created_at DESC 
              LIMIT 1) AS lastMessage,
             (SELECT created_at 
              FROM messages m3 
              WHERE m3.conversation_id = c.id 
              ORDER BY m3.created_at DESC 
              LIMIT 1) AS lastMessageTimestamp
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
      ORDER BY 
        cp.is_pinned DESC,
        COALESCE(lastMessageTimestamp, c.created_at) DESC
    `;

    const conversations = await db.query(sql, [userId, userId]);

    // Attach participants and resolve direct conversation names/avatars/profiles
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const participants = await db.query(
          `SELECT u.id, u.username, u.name, u.avatar, u.bio, u.status, u.last_seen 
           FROM users u 
           JOIN conversation_participants cp ON u.id = cp.user_id 
           WHERE cp.conversation_id = ?`,
          [conv.id]
        );

        let convName = conv.name;
        let convAvatar = conv.avatar;
        let otherUser = null;

        if (conv.type === 'direct') {
          const other = participants.find(p => p.id !== userId);
          if (other) {
            otherUser = other;
            convName = other.name;
            convAvatar = other.avatar;
          }
        }

        return {
          ...conv,
          otherUser,
          status: otherUser ? otherUser.status : 'offline',
          name: convName || 'Conversation',
          avatar: convAvatar || 'https://ui-avatars.com/api/?name=C&background=random',
          participants,
          is_pinned: Boolean(conv.is_pinned),
          is_muted: Boolean(conv.is_muted),
        };
      })
    );

    return enriched;
  }

  /**
   * Get or create a 1:1 direct conversation
   * Guaranteed to never duplicate conversations for the same pair of users
   */
  static async getOrCreateDirectConversation(userId, targetUserId) {
    const targetId = parseInt(targetUserId, 10);
    if (isNaN(targetId) || targetId <= 0) {
      const err = new Error('Valid target user ID is required');
      err.statusCode = 422;
      throw err;
    }

    const currentId = parseInt(userId, 10);
    if (currentId === targetId) {
      const err = new Error('Cannot create a conversation with yourself');
      err.statusCode = 422;
      throw err;
    }

    const targetUser = await db.getOne('SELECT id, name, username FROM users WHERE id = ?', [targetId]);
    if (!targetUser) {
      const err = new Error('Target user not found');
      err.statusCode = 404;
      throw err;
    }

    // Canonical direct key ensures User A + User B always resolves to same record
    const directKey = `${Math.min(currentId, targetId)}_${Math.max(currentId, targetId)}`;

    // 1. Check by direct_key first
    let existing = await db.getOne('SELECT id FROM conversations WHERE direct_key = ?', [directKey]);

    // 2. Fallback check by participants
    if (!existing) {
      const checkSql = `
        SELECT c.id 
        FROM conversations c
        JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
        JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        WHERE c.type = 'direct' AND cp1.user_id = ? AND cp2.user_id = ?
        LIMIT 1
      `;
      existing = await db.getOne(checkSql, [currentId, targetId]);
      if (existing) {
        await db.execute('UPDATE conversations SET direct_key = ? WHERE id = ?', [directKey, existing.id]).catch(() => {});
      }
    }

    if (existing) {
      return await this.getConversationById(existing.id, currentId);
    }

    // 3. Create new direct conversation with direct_key
    try {
      const convResult = await db.execute(
        "INSERT INTO conversations (type, direct_key) VALUES ('direct', ?)",
        [directKey]
      );
      const convId = convResult.lastID;

      await Promise.all([
        db.execute(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
          [convId, currentId]
        ),
        db.execute(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
          [convId, targetId]
        ),
      ]);

      const conv = await this.getConversationById(convId, currentId);
      return { ...conv, isNew: true };
    } catch (err) {
      // If concurrent insertion hit UNIQUE constraint, return the existing conversation
      const winner = await db.getOne('SELECT id FROM conversations WHERE direct_key = ?', [directKey]);
      if (winner) {
        return await this.getConversationById(winner.id, currentId);
      }
      throw err;
    }
  }

  /**
   * Create a group conversation
   */
  static async createGroupConversation(creatorId, name, participantIds = []) {
    if (!name || typeof name !== 'string' || !name.trim()) {
      const err = new Error('Group conversation name is required');
      err.statusCode = 422;
      throw err;
    }

    const groupName = name.trim().slice(0, 100);

    // Normalize and deduplicate participant IDs
    const parsedIds = participantIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
    const uniqueIds = Array.from(new Set([creatorId, ...parsedIds]));

    if (uniqueIds.length < 2) {
      const err = new Error('A group conversation requires at least 2 members');
      err.statusCode = 422;
      throw err;
    }

    const convResult = await db.execute(
      "INSERT INTO conversations (type, name) VALUES ('group', ?)",
      [groupName]
    );
    const convId = convResult.lastID;

    for (const uid of uniqueIds) {
      await db.execute(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
        [convId, uid]
      );
    }

    return await this.getConversationById(convId, creatorId);
  }

  /**
   * Get single conversation details with authorization check
   */
  static async getConversationById(conversationId, userId) {
    const convId = parseInt(conversationId, 10);
    if (isNaN(convId) || convId <= 0) {
      const err = new Error('Invalid conversation ID');
      err.statusCode = 422;
      throw err;
    }

    const conv = await db.getOne('SELECT * FROM conversations WHERE id = ?', [convId]);
    if (!conv) {
      const err = new Error('Conversation not found');
      err.statusCode = 404;
      throw err;
    }

    // Verify membership
    const membership = await db.getOne(
      'SELECT is_pinned, is_muted FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
      [convId, userId]
    );

    if (!membership) {
      const err = new Error('You are not a participant in this conversation');
      err.statusCode = 403;
      throw err;
    }

    const participants = await db.query(
      `SELECT u.id, u.username, u.name, u.avatar, u.bio, u.status, u.last_seen 
       FROM users u 
       JOIN conversation_participants cp ON u.id = cp.user_id 
       WHERE cp.conversation_id = ?`,
      [convId]
    );

    let convName = conv.name;
    let convAvatar = conv.avatar;
    let otherUser = null;

    if (conv.type === 'direct') {
      const other = participants.find(p => p.id !== userId);
      if (other) {
        otherUser = other;
        convName = other.name;
        convAvatar = other.avatar;
      }
    }

    return {
      ...conv,
      otherUser,
      status: otherUser ? otherUser.status : 'offline',
      name: convName || 'Conversation',
      avatar: convAvatar || 'https://ui-avatars.com/api/?name=C&background=random',
      participants,
      is_pinned: Boolean(membership.is_pinned),
      is_muted: Boolean(membership.is_muted),
    };
  }

  /**
   * Update participant preferences (pinned / muted)
   */
  static async updatePreferences(conversationId, userId, { isPinned, isMuted }) {
    const convId = parseInt(conversationId, 10);
    if (isNaN(convId) || convId <= 0) {
      const err = new Error('Invalid conversation ID');
      err.statusCode = 422;
      throw err;
    }

    const isMember = await this.isParticipant(convId, userId);
    if (!isMember) {
      const err = new Error('You are not a participant in this conversation');
      err.statusCode = 403;
      throw err;
    }

    if (isPinned !== undefined) {
      await db.execute(
        'UPDATE conversation_participants SET is_pinned = ? WHERE conversation_id = ? AND user_id = ?',
        [isPinned ? 1 : 0, convId, userId]
      );
    }

    if (isMuted !== undefined) {
      await db.execute(
        'UPDATE conversation_participants SET is_muted = ? WHERE conversation_id = ? AND user_id = ?',
        [isMuted ? 1 : 0, convId, userId]
      );
    }

    return await this.getConversationById(convId, userId);
  }
}

export default ConversationService;
