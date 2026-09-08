import db from '../db.js';
import { ConversationService } from './conversationService.js';

export class MessageService {
  /**
   * Validate and sanitize message content
   */
  static validateAndSanitize(content) {
    if (typeof content !== 'string') {
      const err = new Error('Message content must be a string');
      err.statusCode = 422;
      throw err;
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      const err = new Error('Message content cannot be empty');
      err.statusCode = 422;
      throw err;
    }

    if (trimmed.length > 5000) {
      const err = new Error('Message content exceeds maximum limit of 5000 characters');
      err.statusCode = 422;
      throw err;
    }

    // Strip non-printable ASCII control characters except \n, \r, \t
    const sanitized = trimmed.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '');
    return sanitized;
  }

  /**
   * Create a message in a conversation with strict authorization and validation
   */
  static async createMessage(senderId, conversationId, { content, type = 'text' }) {
    const convId = parseInt(conversationId, 10);
    if (isNaN(convId) || convId <= 0) {
      const err = new Error('Invalid conversation ID');
      err.statusCode = 422;
      throw err;
    }

    // Verify participant authorization
    const isMember = await ConversationService.isParticipant(convId, senderId);
    if (!isMember) {
      const err = new Error('You are not authorized to post in this conversation');
      err.statusCode = 403;
      throw err;
    }

    // Validate type
    const validTypes = ['text', 'image', 'voice', 'file', 'code', 'system'];
    const msgType = validTypes.includes(type) ? type : 'text';

    // Validate and sanitize content
    const sanitizedContent = this.validateAndSanitize(content);

    // Insert message
    const result = await db.execute(
      `INSERT INTO messages (conversation_id, sender_id, content, type, status, created_at) 
       VALUES (?, ?, ?, ?, 'sent', CURRENT_TIMESTAMP)`,
      [convId, senderId, sanitizedContent, msgType]
    );

    const messageId = result.lastID;

    // Update conversation timestamp
    await db.execute(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [convId]
    );

    // Return message with sender info
    const message = await db.getOne(
      `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    return message;
  }

  /**
   * Get paginated messages for a conversation with authorization
   */
  static async getMessages(conversationId, userId, { page, limit = 30, before } = {}) {
    const convId = parseInt(conversationId, 10);
    if (isNaN(convId) || convId <= 0) {
      const err = new Error('Invalid conversation ID');
      err.statusCode = 422;
      throw err;
    }

    // Verify authorization
    const isMember = await ConversationService.isParticipant(convId, userId);
    if (!isMember) {
      const err = new Error('You are not authorized to access messages in this conversation');
      err.statusCode = 403;
      throw err;
    }

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 50);

    // Total count in conversation
    const countRow = await db.getOne(
      'SELECT COUNT(*) AS total FROM messages WHERE conversation_id = ?',
      [convId]
    );
    const total = countRow ? countRow.total : 0;

    let rows = [];
    let hasMore = false;

    if (before) {
      const beforeId = parseInt(before, 10);
      const sql = `
        SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ? AND m.id < ?
        ORDER BY m.id DESC
        LIMIT ?
      `;
      // Fetch 1 extra to check hasMore
      const rawRows = await db.query(sql, [convId, beforeId, safeLimit + 1]);
      if (rawRows.length > safeLimit) {
        hasMore = true;
        rows = rawRows.slice(0, safeLimit);
      } else {
        rows = rawRows;
        hasMore = false;
      }
    } else {
      const safePage = Math.max(parseInt(page, 10) || 1, 1);
      const offset = (safePage - 1) * safeLimit;
      const sql = `
        SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ?
        ORDER BY m.id DESC
        LIMIT ? OFFSET ?
      `;
      rows = await db.query(sql, [convId, safeLimit, offset]);
      hasMore = offset + rows.length < total;
    }

    // Reverse to return in chronological order for chat view
    const messages = rows.reverse();
    const oldestId = messages.length > 0 ? messages[0].id : null;
    const newestId = messages.length > 0 ? messages[messages.length - 1].id : null;

    return {
      messages,
      pagination: {
        page: page ? parseInt(page, 10) : 1,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
        hasMore,
        oldestId,
        newestId
      }
    };
  }

  /**
   * Edit own message
   */
  static async editMessage(messageId, userId, newContent) {
    const msgId = parseInt(messageId, 10);
    const uId = parseInt(userId, 10);
    if (isNaN(msgId) || msgId <= 0) {
      const err = new Error('Invalid message ID');
      err.statusCode = 422;
      throw err;
    }

    const message = await db.getOne('SELECT * FROM messages WHERE id = ?', [msgId]);
    if (!message) {
      const err = new Error('Message not found');
      err.statusCode = 404;
      throw err;
    }

    if (message.sender_id !== uId) {
      const err = new Error('Unauthorized: You can only edit your own messages');
      err.statusCode = 403;
      throw err;
    }

    const sanitizedContent = this.validateAndSanitize(newContent);

    await db.execute(
      'UPDATE messages SET content = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [sanitizedContent, msgId]
    );

    const updated = await db.getOne(
      `SELECT m.*, u.username AS sender_username, u.name AS sender_name, u.avatar AS sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [msgId]
    );

    return updated;
  }

  /**
   * Delete own message
   */
  static async deleteMessage(messageId, userId) {
    const msgId = parseInt(messageId, 10);
    const uId = parseInt(userId, 10);
    if (isNaN(msgId) || msgId <= 0) {
      const err = new Error('Invalid message ID');
      err.statusCode = 422;
      throw err;
    }

    const message = await db.getOne('SELECT * FROM messages WHERE id = ?', [msgId]);
    if (!message) {
      const err = new Error('Message not found');
      err.statusCode = 404;
      throw err;
    }

    if (message.sender_id !== uId) {
      const err = new Error('Unauthorized: You can only delete your own messages');
      err.statusCode = 403;
      throw err;
    }

    await db.execute('DELETE FROM messages WHERE id = ?', [msgId]);

    return {
      success: true,
      messageId: msgId,
      conversationId: message.conversation_id
    };
  }

  /**
   * Mark messages as read in a conversation
   */
  static async markAsRead(conversationId, userId) {
    const convId = parseInt(conversationId, 10);
    if (isNaN(convId) || convId <= 0) return { updated: 0 };

    const result = await db.execute(
      `UPDATE messages 
       SET status = 'read', read_at = CURRENT_TIMESTAMP 
       WHERE conversation_id = ? AND sender_id != ? AND status != 'read'`,
      [convId, userId]
    );

    return { updated: result.changes };
  }

  /**
   * Mark message as delivered for a recipient
   */
  static async markAsDelivered(messageId, userId) {
    const msgId = parseInt(messageId, 10);
    if (isNaN(msgId) || msgId <= 0) return { updated: 0 };

    const result = await db.execute(
      `UPDATE messages 
       SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND sender_id != ? AND status = 'sent'`,
      [msgId, userId]
    );

    return { updated: result.changes };
  }
}

export default MessageService;
