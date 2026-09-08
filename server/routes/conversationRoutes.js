import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { ConversationService } from '../services/conversationService.js';
import { MessageService } from '../services/messageService.js';

export const createConversationRouter = (io) => {
  const router = Router();

  /**
   * GET /api/conversations
   * Get all conversations for current user
   */
  router.get('/', authenticateToken, async (req, res, next) => {
    try {
      const conversations = await ConversationService.getUserConversations(req.user.id);
      res.json(conversations);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/conversations
   * Create or retrieve direct (1:1) or group conversation
   */
  router.post('/', authenticateToken, async (req, res, next) => {
    try {
      const { type, name, participantIds, userId } = req.body;

      if (type === 'group') {
        const conversation = await ConversationService.createGroupConversation(
          req.user.id,
          name,
          participantIds
        );
        return res.status(201).json(conversation);
      }

      // Default: Direct 1:1 conversation
      const otherUserId = userId || (participantIds && participantIds[0]);
      if (!otherUserId) {
        return res.status(422).json({ error: 'Target user ID is required to start a direct conversation' });
      }

      const conversation = await ConversationService.getOrCreateDirectConversation(
        req.user.id,
        otherUserId
      );

      res.status(conversation.isNew ? 201 : 200).json(conversation);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/conversations/:id
   * Get single conversation details
   */
  router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
      const conversation = await ConversationService.getConversationById(req.params.id, req.user.id);
      res.json(conversation);
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/conversations/:id/preferences
   * Update isPinned and/or isMuted for current user
   */
  router.patch('/:id/preferences', authenticateToken, async (req, res, next) => {
    try {
      const { isPinned, isMuted } = req.body;
      const conversation = await ConversationService.updatePreferences(
        req.params.id,
        req.user.id,
        { isPinned, isMuted }
      );
      res.json(conversation);
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/conversations/:id/messages
   * Paginated message history for conversation
   */
  router.get('/:id/messages', authenticateToken, async (req, res, next) => {
    try {
      const { page, limit, before, format } = req.query;
      const result = await MessageService.getMessages(req.params.id, req.user.id, { page, limit, before });

      // Automatically mark messages as read for this user
      MessageService.markAsRead(req.params.id, req.user.id).catch(() => {});

      // Headers for pagination
      res.setHeader('X-Total-Count', result.pagination.total);
      res.setHeader('X-Total-Pages', result.pagination.totalPages);
      res.setHeader('X-Current-Page', result.pagination.page);
      res.setHeader('X-Has-More', result.pagination.hasMore ? 'true' : 'false');
      if (result.pagination.oldestId) res.setHeader('X-Oldest-Id', result.pagination.oldestId);
      if (result.pagination.newestId) res.setHeader('X-Newest-Id', result.pagination.newestId);

      if (format === 'paginated') {
        return res.json(result);
      }

      res.json(result.messages);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/conversations/:id/read
   * Mark all messages in conversation as read
   */
  router.post('/:id/read', authenticateToken, async (req, res, next) => {
    try {
      const result = await MessageService.markAsRead(req.params.id, req.user.id);
      if (io) {
        io.to(`conversation:${req.params.id}`).emit('message:update', {
          conversationId: req.params.id,
          status: 'read',
          readAt: new Date().toISOString()
        });
      }
      res.json({ success: true, updated: result.updated });
    } catch (err) {
      next(err);
    }
  });

  /**
   * PATCH /api/conversations/:id/messages/:messageId
   * Edit own message
   */
  router.patch('/:id/messages/:messageId', authenticateToken, async (req, res, next) => {
    try {
      const { content } = req.body;
      const updatedMessage = await MessageService.editMessage(req.params.messageId, req.user.id, content);

      if (io) {
        io.to(`conversation:${req.params.id}`).emit('message:edited', {
          messageId: updatedMessage.id,
          conversationId: updatedMessage.conversation_id,
          content: updatedMessage.content,
          isEdited: true,
          updatedAt: updatedMessage.updated_at
        });
      }

      res.json(updatedMessage);
    } catch (err) {
      next(err);
    }
  });

  /**
   * DELETE /api/conversations/:id/messages/:messageId
   * Delete own message
   */
  router.delete('/:id/messages/:messageId', authenticateToken, async (req, res, next) => {
    try {
      const result = await MessageService.deleteMessage(req.params.messageId, req.user.id);

      if (io) {
        io.to(`conversation:${req.params.id}`).emit('message:deleted', {
          messageId: result.messageId,
          conversationId: result.conversationId
        });
      }

      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/conversations/:id/messages
   * Send a new message via REST API
   */
  router.post('/:id/messages', authenticateToken, async (req, res, next) => {
    try {
      const { content, type } = req.body;
      const message = await MessageService.createMessage(req.user.id, req.params.id, { content, type });

      // Broadcast to real-time conversation room if Socket.IO is active
      if (io) {
        io.to(`conversation:${req.params.id}`).emit('message:new', message);
      }

      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  });

  return router;
};

export default createConversationRouter;
