import db from '../db.js';

export class ConnectionService {
  /**
   * Send a connection request to another user
   */
  static async sendRequest(requesterId, receiverId) {
    const targetId = parseInt(receiverId, 10);
    if (isNaN(targetId) || targetId <= 0) {
      const err = new Error('Valid receiver ID is required');
      err.statusCode = 422;
      throw err;
    }

    if (requesterId === targetId) {
      const err = new Error('Cannot send connection request to yourself');
      err.statusCode = 422;
      throw err;
    }

    // Verify recipient exists
    const recipient = await db.getOne('SELECT id, name, username FROM users WHERE id = ?', [targetId]);
    if (!recipient) {
      const err = new Error('Recipient user not found');
      err.statusCode = 404;
      throw err;
    }

    // Check bidirectional existing connection
    const existing = await db.getOne(
      `SELECT * FROM connections 
       WHERE (requester_id = ? AND receiver_id = ?) 
          OR (requester_id = ? AND receiver_id = ?)`,
      [requesterId, targetId, targetId, requesterId]
    );

    if (existing) {
      if (existing.status === 'accepted') {
        const err = new Error('You are already connected with this user');
        err.statusCode = 409;
        throw err;
      }

      if (existing.status === 'pending') {
        if (existing.requester_id === requesterId) {
          const err = new Error('Connection request has already been sent and is pending');
          err.statusCode = 409;
          throw err;
        } else {
          const err = new Error('This user has already sent you a connection request. Please accept it instead.');
          err.statusCode = 409;
          throw err;
        }
      }

      // If previously rejected, re-open as pending
      if (existing.status === 'rejected') {
        await db.execute(
          `UPDATE connections 
           SET requester_id = ?, receiver_id = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          [requesterId, targetId, existing.id]
        );
        return await db.getOne('SELECT * FROM connections WHERE id = ?', [existing.id]);
      }
    }

    // Insert new pending connection
    const result = await db.execute(
      `INSERT INTO connections (requester_id, receiver_id, status, created_at, updated_at) 
       VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [requesterId, targetId]
    );

    return await db.getOne('SELECT * FROM connections WHERE id = ?', [result.lastID]);
  }

  /**
   * Get all pending incoming & outgoing connection requests for a user
   */
  static async getRequests(userId) {
    const incomingSql = `
      SELECT c.id, c.requester_id, c.receiver_id, c.status, c.created_at,
             u.id AS user_id, u.username, u.name, u.avatar, u.bio, u.status AS user_status, u.last_seen
      FROM connections c
      JOIN users u ON c.requester_id = u.id
      WHERE c.receiver_id = ? AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `;

    const outgoingSql = `
      SELECT c.id, c.requester_id, c.receiver_id, c.status, c.created_at,
             u.id AS user_id, u.username, u.name, u.avatar, u.bio, u.status AS user_status, u.last_seen
      FROM connections c
      JOIN users u ON c.receiver_id = u.id
      WHERE c.requester_id = ? AND c.status = 'pending'
      ORDER BY c.created_at DESC
    `;

    const [incoming, outgoing] = await Promise.all([
      db.query(incomingSql, [userId]),
      db.query(outgoingSql, [userId])
    ]);

    return { incoming, outgoing };
  }

  /**
   * Get all accepted connections for a user
   */
  static async getConnections(userId) {
    const sql = `
      SELECT c.id AS connection_id, c.created_at AS connected_at,
             u.id, u.username, u.name, u.avatar, u.bio, u.status, u.last_seen
      FROM connections c
      JOIN users u ON (c.requester_id = u.id OR c.receiver_id = u.id)
      WHERE (c.requester_id = ? OR c.receiver_id = ?) 
        AND c.status = 'accepted'
        AND u.id != ?
      ORDER BY u.name ASC
    `;

    return await db.query(sql, [userId, userId, userId]);
  }

  /**
   * Accept a pending connection request
   */
  static async acceptRequest(connectionId, userId) {
    const connId = parseInt(connectionId, 10);
    if (isNaN(connId) || connId <= 0) {
      const err = new Error('Invalid connection ID');
      err.statusCode = 422;
      throw err;
    }

    const connection = await db.getOne('SELECT * FROM connections WHERE id = ?', [connId]);
    if (!connection) {
      const err = new Error('Connection request not found');
      err.statusCode = 404;
      throw err;
    }

    if (connection.receiver_id !== userId) {
      const err = new Error('Not authorized to accept this connection request');
      err.statusCode = 403;
      throw err;
    }

    if (connection.status === 'accepted') {
      return connection;
    }

    await db.execute(
      "UPDATE connections SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [connId]
    );

    return await db.getOne('SELECT * FROM connections WHERE id = ?', [connId]);
  }

  /**
   * Reject a pending connection request
   */
  static async rejectRequest(connectionId, userId) {
    const connId = parseInt(connectionId, 10);
    if (isNaN(connId) || connId <= 0) {
      const err = new Error('Invalid connection ID');
      err.statusCode = 422;
      throw err;
    }

    const connection = await db.getOne('SELECT * FROM connections WHERE id = ?', [connId]);
    if (!connection) {
      const err = new Error('Connection request not found');
      err.statusCode = 404;
      throw err;
    }

    if (connection.receiver_id !== userId) {
      const err = new Error('Not authorized to reject this connection request');
      err.statusCode = 403;
      throw err;
    }

    await db.execute(
      "UPDATE connections SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [connId]
    );

    return { success: true, message: 'Connection request rejected' };
  }

  /**
   * Cancel a pending connection request sent by current user
   */
  static async cancelRequest(connectionId, userId) {
    const connId = parseInt(connectionId, 10);
    if (isNaN(connId) || connId <= 0) {
      const err = new Error('Invalid connection ID');
      err.statusCode = 422;
      throw err;
    }

    const connection = await db.getOne('SELECT * FROM connections WHERE id = ?', [connId]);
    if (!connection) {
      const err = new Error('Connection request not found');
      err.statusCode = 404;
      throw err;
    }

    if (connection.requester_id !== userId) {
      const err = new Error('Not authorized to cancel this connection request');
      err.statusCode = 403;
      throw err;
    }

    if (connection.status !== 'pending') {
      const err = new Error('Can only cancel pending connection requests');
      err.statusCode = 422;
      throw err;
    }

    await db.execute('DELETE FROM connections WHERE id = ?', [connId]);

    return { success: true, message: 'Connection request cancelled' };
  }

  /**
   * Delete / Remove a connection (either party can remove)
   */
  static async deleteConnection(connectionId, userId) {
    const connId = parseInt(connectionId, 10);
    if (isNaN(connId) || connId <= 0) {
      const err = new Error('Invalid connection ID');
      err.statusCode = 422;
      throw err;
    }

    const connection = await db.getOne('SELECT * FROM connections WHERE id = ?', [connId]);
    if (!connection) {
      const err = new Error('Connection not found');
      err.statusCode = 404;
      throw err;
    }

    if (connection.requester_id !== userId && connection.receiver_id !== userId) {
      const err = new Error('Not authorized to delete this connection');
      err.statusCode = 403;
      throw err;
    }

    await db.execute('DELETE FROM connections WHERE id = ?', [connId]);

    return { success: true, message: 'Connection removed successfully' };
  }

  /**
   * Check if two users have an active (accepted) connection
   */
  static async areUsersConnected(userA, userB) {
    const uA = parseInt(userA, 10);
    const uB = parseInt(userB, 10);
    if (isNaN(uA) || isNaN(uB) || uA <= 0 || uB <= 0 || uA === uB) return false;

    const row = await db.getOne(
      `SELECT 1 FROM connections 
       WHERE ((requester_id = ? AND receiver_id = ?) OR (requester_id = ? AND receiver_id = ?)) 
         AND status = 'accepted'`,
      [uA, uB, uB, uA]
    );
    return !!row;
  }
}

export default ConnectionService;
