import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

import db from './db.js';
import { JWT_SECRET } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { createConnectionRouter } from './routes/connectionRoutes.js';
import { createConversationRouter } from './routes/conversationRoutes.js';

import { UserService } from './services/userService.js';
import { MessageService } from './services/messageService.js';
import { ConversationService } from './services/conversationService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Global middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// HTTP Server & Socket.IO instance
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', createConnectionRouter(io));
app.use('/api/conversations', createConversationRouter(io));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized error handling
app.use(errorHandler);

// --- SOCKET.IO REAL-TIME ENGINE ---

// Socket authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid or expired authentication token'));
    socket.user = { id: parseInt(decoded.id, 10) };
    next();
  });
});

const userSockets = new Map(); // Map<userId, Set<socketId>>

io.on('connection', (socket) => {
  const userId = socket.user.id;

  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  // Mark user online in database and broadcast presence without blocking listener setup
  UserService.updateStatus(userId, 'online').catch(console.error);
  io.emit('user:online', { userId, status: 'online' });
  io.emit('user:status', { userId, status: 'online' });

  // Join private room for user-targeted events (e.g. connection requests, sidebar updates)
  socket.join(`user:${userId}`);

  // Disconnect handler
  socket.on('disconnect', async () => {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        await UserService.updateStatus(userId, 'offline');
        const lastSeen = new Date().toISOString();
        io.emit('user:offline', {
          userId,
          status: 'offline',
          last_seen: lastSeen
        });
        io.emit('user:status', {
          userId,
          status: 'offline',
          last_seen: lastSeen
        });
      }
    }
  });

  // Join conversation room with strict membership verification
  socket.on('conversation:join', async (conversationId) => {
    try {
      const isMember = await ConversationService.isParticipant(conversationId, userId);
      if (!isMember) {
        socket.emit('error', { message: 'Not authorized to join this conversation' });
        return;
      }
      socket.join(`conversation:${conversationId}`);
      socket.emit('conversation:joined', { conversationId });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // Leave conversation room
  socket.on('conversation:leave', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    socket.emit('conversation:left', { conversationId });
  });

  // Typing indicators with membership guard
  socket.on('typing:start', async ({ conversationId }) => {
    try {
      const isMember = await ConversationService.isParticipant(conversationId, userId);
      if (isMember) {
        socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId });
      }
    } catch (e) {}
  });

  socket.on('typing:stop', async ({ conversationId }) => {
    try {
      const isMember = await ConversationService.isParticipant(conversationId, userId);
      if (isMember) {
        socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
      }
    } catch (e) {}
  });

  // Real-time message sending via Socket.IO with strict FIFO queue
  let sendQueue = Promise.resolve();
  socket.on('message:send', (data, callback) => {
    sendQueue = sendQueue.then(async () => {
      try {
        const { conversationId, content, type = 'text' } = data || {};
        
        // Strict authorization check: never trust senderId from client
        const isMember = await ConversationService.isParticipant(conversationId, userId);
        if (!isMember) {
          const errorMsg = 'Unauthorized: You do not belong to this conversation';
          if (typeof callback === 'function') callback({ error: errorMsg });
          socket.emit('error', { message: errorMsg });
          return;
        }

        const message = await MessageService.createMessage(userId, conversationId, { content, type });

        // 1. Emit confirmation event to sender socket
        socket.emit('message:sent', message);

        // 2. Acknowledge callback if sender provided one
        if (typeof callback === 'function') {
          callback({ message });
        }

        // 3. Broadcast to active conversation room and participant user rooms without duplication
        const participants = await db.query(
          'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
          [conversationId, userId]
        );
        const recipientRooms = [
          `conversation:${conversationId}`,
          ...participants.map((p) => `user:${p.user_id}`)
        ];
        socket.to(recipientRooms).emit('message:new', message);
      } catch (err) {
        if (typeof callback === 'function') {
          callback({ error: err.message });
        } else {
          socket.emit('error', { message: err.message });
        }
      }
    }).catch((err) => {
      console.error('Socket message queue error:', err);
    });
  });

  // Message delivered receipt
  socket.on('message:delivered', async ({ messageId, conversationId }) => {
    try {
      if (!messageId) return;
      await MessageService.markAsDelivered(messageId, userId);
      const deliveredAt = new Date().toISOString();
      if (conversationId) {
        io.to(`conversation:${conversationId}`).emit('message:update', {
          messageId,
          conversationId,
          status: 'delivered',
          deliveredAt
        });
      }
    } catch (err) {
      console.error('Socket message:delivered error:', err.message);
    }
  });

  // Message read receipt
  socket.on('message:read', async ({ messageId, conversationId }) => {
    try {
      if (!conversationId) return;
      await MessageService.markAsRead(conversationId, userId);
      const readAt = new Date().toISOString();
      
      const participants = await db.query(
        'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
        [conversationId, userId]
      );
      const recipientRooms = [
        `conversation:${conversationId}`,
        ...participants.map((p) => `user:${p.user_id}`)
      ];

      io.to(recipientRooms).emit('message:update', {
        messageId,
        conversationId,
        status: 'read',
        readAt
      });
    } catch (err) {
      console.error('Socket message:read error:', err.message);
    }
  });

  // Real-time message edit
  socket.on('message:edit', async ({ messageId, conversationId, content }, callback) => {
    try {
      const updatedMessage = await MessageService.editMessage(messageId, userId, content);
      
      const participants = await db.query(
        'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
        [conversationId, userId]
      );
      const recipientRooms = [
        `conversation:${conversationId}`,
        ...participants.map((p) => `user:${p.user_id}`)
      ];

      io.to(recipientRooms).emit('message:edited', {
        messageId: updatedMessage.id,
        conversationId: updatedMessage.conversation_id,
        content: updatedMessage.content,
        isEdited: true,
        updatedAt: updatedMessage.updated_at
      });

      if (typeof callback === 'function') callback({ message: updatedMessage });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
      else socket.emit('error', { message: err.message });
    }
  });

  // Real-time message delete
  socket.on('message:delete', async ({ messageId, conversationId }, callback) => {
    try {
      const result = await MessageService.deleteMessage(messageId, userId);
      
      const participants = await db.query(
        'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
        [conversationId, userId]
      );
      const recipientRooms = [
        `conversation:${conversationId}`,
        ...participants.map((p) => `user:${p.user_id}`)
      ];

      io.to(recipientRooms).emit('message:deleted', {
        messageId: result.messageId,
        conversationId: result.conversationId
      });

      if (typeof callback === 'function') callback({ success: true, messageId: result.messageId });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
      else socket.emit('error', { message: err.message });
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export { app, httpServer, io };
