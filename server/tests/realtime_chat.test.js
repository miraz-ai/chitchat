import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import jwt from 'jsonwebtoken';

import db from '../db.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';
import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import { createConnectionRouter } from '../routes/connectionRoutes.js';
import { createConversationRouter } from '../routes/conversationRoutes.js';
import { UserService } from '../services/userService.js';
import { MessageService } from '../services/messageService.js';
import { ConversationService } from '../services/conversationService.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', createConnectionRouter(io));
app.use('/api/conversations', createConversationRouter(io));
app.use(errorHandler);

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid or expired authentication token'));
    socket.user = { id: parseInt(decoded.id, 10) };
    next();
  });
});

const userSockets = new Map();

io.on('connection', (socket) => {
  const userId = socket.user.id;
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socket.id);

  UserService.updateStatus(userId, 'online').catch(console.error);
  io.emit('user:online', { userId, status: 'online' });
  io.emit('user:status', { userId, status: 'online' });
  socket.join(`user:${userId}`);

  socket.on('disconnect', async () => {
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        await UserService.updateStatus(userId, 'offline');
        const lastSeen = new Date().toISOString();
        io.emit('user:offline', { userId, status: 'offline', last_seen: lastSeen });
        io.emit('user:status', { userId, status: 'offline', last_seen: lastSeen });
      }
    }
  });

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

  socket.on('conversation:leave', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
    socket.emit('conversation:left', { conversationId });
  });

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

  let sendQueue = Promise.resolve();
  socket.on('message:send', (data, callback) => {
    sendQueue = sendQueue.then(async () => {
      try {
        const { conversationId, content, type = 'text' } = data || {};
        const isMember = await ConversationService.isParticipant(conversationId, userId);
        if (!isMember) {
          const errorMsg = 'Unauthorized: You do not belong to this conversation';
          if (typeof callback === 'function') callback({ error: errorMsg });
          socket.emit('error', { message: errorMsg });
          return;
        }

        const message = await MessageService.createMessage(userId, conversationId, { content, type });

        socket.emit('message:sent', message);
        if (typeof callback === 'function') callback({ message });

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
        if (typeof callback === 'function') callback({ error: err.message });
        else socket.emit('error', { message: err.message });
      }
    }).catch(console.error);
  });

  socket.on('message:delivered', async ({ messageId, conversationId }) => {
    try {
      if (!messageId) return;
      await MessageService.markAsDelivered(messageId, userId);
      if (conversationId) {
        io.to(`conversation:${conversationId}`).emit('message:update', {
          messageId,
          conversationId,
          status: 'delivered'
        });
      }
    } catch (err) {}
  });

  socket.on('message:read', async ({ messageId, conversationId }) => {
    try {
      if (!conversationId) return;
      await MessageService.markAsRead(conversationId, userId);
      io.to(`conversation:${conversationId}`).emit('message:update', {
        messageId,
        conversationId,
        status: 'read'
      });
    } catch (err) {}
  });
});

let serverPort;
let baseUrl;
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function runRealtimeChatTests() {
  console.log('\n==================================================================');
  console.log('⚡ PHASE 5: REAL-TIME CHAT ENGINE TEST SUITE');
  console.log('==================================================================\n');

  await new Promise((resolve) => {
    httpServer.listen(0, () => {
      serverPort = httpServer.address().port;
      baseUrl = `http://localhost:${serverPort}`;
      resolve();
    });
  });

  const runId = Date.now().toString().slice(-6);

  // 1. Setup Users A, B, and C
  console.log('--- TEST 1: Provisioning Users for Real-Time Tests ---');
  const regUser = async (user) => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    return await res.json();
  };

  const userAData = await regUser({
    username: `rt_alice_${runId}`,
    name: 'Alice Zuberg',
    email: `rt_alice_${runId}@test.com`,
    password: 'Password123!@#'
  });
  const userBData = await regUser({
    username: `rt_eugeo_${runId}`,
    name: 'Eugeo Synthesis',
    email: `rt_eugeo_${runId}@test.com`,
    password: 'Password123!@#'
  });
  const userCData = await regUser({
    username: `rt_unauth_${runId}`,
    name: 'Unauthorized User',
    email: `rt_unauth_${runId}@test.com`,
    password: 'Password123!@#'
  });

  const userA = userAData.user;
  const tokenA = userAData.token;
  const userB = userBData.user;
  const tokenB = userBData.token;
  const userC = userCData.user;
  const tokenC = userCData.token;

  assert(tokenA && tokenB && tokenC, 'User tokens generated successfully');

  // Create 1:1 conversation between User A and User B
  const convRes = await fetch(`${baseUrl}/api/conversations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userB.id })
  });
  const conversation = await convRes.json();
  const convId = conversation.id;
  assert(convId && conversation.type === 'direct', 'Created direct conversation for A and B');

  // 2. Unauthenticated Socket Connection Rejection
  console.log('\n--- TEST 2: Socket Authentication Verification ---');
  const unauthSocket = Client(baseUrl, {
    auth: { token: 'bad.token.signature' },
    transports: ['websocket'],
    reconnection: false
  });

  const unauthRejected = await new Promise((res) => {
    unauthSocket.on('connect_error', (err) => {
      res(err.message.includes('token') || err.message.includes('Authentication'));
    });
    unauthSocket.on('connect', () => res(false));
  });
  assert(unauthRejected, 'Unauthenticated socket connection strictly rejected with error');
  unauthSocket.close();

  // 3. Authenticated Socket Connections & Presence
  console.log('\n--- TEST 3: Authenticated Connection & Presence Tracking ---');
  const socketA = Client(baseUrl, {
    auth: { token: tokenA },
    transports: ['websocket']
  });
  const socketB = Client(baseUrl, {
    auth: { token: tokenB },
    transports: ['websocket']
  });

  await Promise.all([
    new Promise(res => socketA.on('connect', res)),
    new Promise(res => socketB.on('connect', res))
  ]);
  assert(socketA.connected && socketB.connected, 'Sockets for User A and User B connected and authenticated');

  // Verify online status in DB
  const userADB = await UserService.getUserById(userA.id, true);
  const userBDB = await UserService.getUserById(userB.id, true);
  assert(userADB.status === 'online', 'User A status marked as online in database');
  assert(userBDB.status === 'online', 'User B status marked as online in database');

  // 4. Conversation Room Joining & Authorization Guard
  console.log('\n--- TEST 4: Conversation Rooms & Membership Authorization ---');
  // Socket A and Socket B join authorized conversation
  const joinAPromise = new Promise(res => socketA.once('conversation:joined', res));
  const joinBPromise = new Promise(res => socketB.once('conversation:joined', res));
  socketA.emit('conversation:join', convId);
  socketB.emit('conversation:join', convId);
  const [joinA, joinB] = await Promise.all([joinAPromise, joinBPromise]);
  assert(joinA.conversationId === convId, 'User A successfully joined conversation room');
  assert(joinB.conversationId === convId, 'User B successfully joined conversation room');

  // Unauthorized User C attempts to join conversation room
  const socketC = Client(baseUrl, {
    auth: { token: tokenC },
    transports: ['websocket']
  });
  await new Promise(res => socketC.on('connect', res));

  const unauthJoinRejected = await new Promise(res => {
    socketC.once('error', (err) => {
      res(err.message && err.message.includes('Not authorized'));
    });
    socketC.emit('conversation:join', convId);
    setTimeout(() => res(false), 1500);
  });
  assert(unauthJoinRejected, 'Unauthorized User C joining conversation room rejected with error');

  // 5. Real-Time Messaging: A → B
  console.log('\n--- TEST 5: Real-Time Message Flow A → B ---');
  const msgTextAB = 'Hello Eugeo! Can you hear me?';
  const msgFromAForB = new Promise(res => {
    socketB.once('message:new', (msg) => res(msg));
  });
  const msgSentAckA = new Promise(res => {
    socketA.once('message:sent', (msg) => res(msg));
  });

  socketA.emit('message:send', { conversationId: convId, content: msgTextAB });
  const [receivedMsgB, sentAckA] = await Promise.all([msgFromAForB, msgSentAckA]);

  assert(receivedMsgB.content === msgTextAB, 'User B received message:new with exact content');
  assert(receivedMsgB.sender_id === userA.id, 'Message sender_id correctly attributed to User A');
  assert(sentAckA.id === receivedMsgB.id, 'Sender A received message:sent confirmation matching message ID');

  // 6. Real-Time Messaging: B → A
  console.log('\n--- TEST 6: Real-Time Message Flow B → A ---');
  const msgTextBA = 'Loud and clear, Alice!';
  const msgFromBForA = new Promise(res => {
    socketA.once('message:new', (msg) => res(msg));
  });

  socketB.emit('message:send', { conversationId: convId, content: msgTextBA });
  const receivedMsgA = await msgFromBForA;

  assert(receivedMsgA.content === msgTextBA, 'User A received message:new with exact content from User B');
  assert(receivedMsgA.sender_id === userB.id, 'Message sender_id correctly attributed to User B');

  // 7. Delivery & Read Receipts
  console.log('\n--- TEST 7: Message Delivery & Read Receipts ---');
  // Delivery receipt: User B emits message:delivered for receivedMsgB
  const deliveredPromise = new Promise(res => {
    socketA.once('message:update', (update) => {
      if (update.status === 'delivered' && update.messageId === receivedMsgB.id) res(update);
    });
  });
  socketB.emit('message:delivered', { messageId: receivedMsgB.id, conversationId: convId });
  const deliveredUpdate = await deliveredPromise;
  assert(deliveredUpdate.status === 'delivered', 'User A received message:update with status "delivered"');

  // Read receipt: User B emits message:read for conversation
  const readPromise = new Promise(res => {
    socketA.once('message:update', (update) => {
      if (update.status === 'read' && update.conversationId === convId) res(update);
    });
  });
  socketB.emit('message:read', { conversationId: convId, messageId: receivedMsgB.id });
  const readUpdate = await readPromise;
  assert(readUpdate.status === 'read', 'User A received message:update with status "read"');

  // 8. Typing Indicators
  console.log('\n--- TEST 8: Typing Indicators (typing:start & typing:stop) ---');
  const typingStartPromise = new Promise(res => {
    socketB.once('typing:start', (data) => res(data));
  });
  socketA.emit('typing:start', { conversationId: convId });
  const typingStartData = await typingStartPromise;
  assert(typingStartData.userId === userA.id, 'User B received typing:start indicator from User A');

  const typingStopPromise = new Promise(res => {
    socketB.once('typing:stop', (data) => res(data));
  });
  socketA.emit('typing:stop', { conversationId: convId });
  const typingStopData = await typingStopPromise;
  assert(typingStopData.userId === userA.id, 'User B received typing:stop indicator from User A');

  // 9. Rapid Messages & Ordering
  console.log('\n--- TEST 9: Rapid Messaging & Strict Chronological Ordering ---');
  const rapidCount = 5;
  const receivedRapid = [];
  const rapidPromise = new Promise(res => {
    const handler = (msg) => {
      if (msg.content.startsWith('Rapid_')) {
        receivedRapid.push(msg);
        if (receivedRapid.length === rapidCount) {
          socketB.off('message:new', handler);
          res(receivedRapid);
        }
      }
    };
    socketB.on('message:new', handler);
  });

  for (let i = 1; i <= rapidCount; i++) {
    socketA.emit('message:send', { conversationId: convId, content: `Rapid_${i}` });
  }

  const allRapid = await rapidPromise;
  assert(allRapid.length === 5, 'All 5 rapid messages received');
  const isChronological = allRapid.every((m, idx) => m.content === `Rapid_${idx + 1}`);
  assert(isChronological, 'Rapid messages delivered in exact chronological order without drops');

  // 10. Security: Anti-Spoofing & Unauthorized Message Sending
  console.log('\n--- TEST 10: Security Guards & Anti-Spoofing ---');
  // Attempt to spoof senderId: User A tries to send message claiming to be User B
  const spoofMsgPromise = new Promise(res => {
    socketB.once('message:new', res);
  });
  socketA.emit('message:send', {
    conversationId: convId,
    content: 'Spoofed sender attempt',
    senderId: userB.id
  });
  const spoofMsg = await spoofMsgPromise;
  assert(spoofMsg.sender_id === userA.id, 'Server strictly overrode client-supplied senderId with authenticated User A ID');

  // Unauthorized sending: User C attempts to send in convId
  const unauthSendError = await new Promise(res => {
    socketC.emit('message:send', { conversationId: convId, content: 'Hacked message' }, (ack) => {
      res(ack && ack.error && ack.error.includes('Unauthorized'));
    });
  });
  assert(unauthSendError, 'Unauthorized User C sending message in conversation rejected with error');

  // 11. Disconnect & Presence Tracking
  console.log('\n--- TEST 11: Real Presence: Disconnect & Reconnect Events ---');
  const offlinePromise = new Promise(res => {
    socketA.once('user:offline', (data) => {
      if (data.userId === userB.id) res(data);
    });
  });

  socketB.disconnect();
  const offlineData = await offlinePromise;
  assert(offlineData.status === 'offline', 'User A received user:offline when User B disconnected');
  assert(offlineData.last_seen !== undefined, 'user:offline includes accurate last_seen timestamp');

  // Reconnect User B
  const onlinePromise = new Promise(res => {
    socketA.once('user:online', (data) => {
      if (data.userId === userB.id) res(data);
    });
  });
  socketB.connect();
  const onlineData = await onlinePromise;
  assert(onlineData.status === 'online', 'User A received user:online when User B reconnected');

  // 12. Message Persistence Verification
  console.log('\n--- TEST 12: Database Message Persistence Across Sessions ---');
  // Disconnect all sockets
  socketA.close();
  socketB.close();
  socketC.close();

  // Query database via REST API to verify all messages are persisted
  const historyRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(historyRes.status === 200, 'GET /api/conversations/:id/messages returns 200 OK');
  const history = await historyRes.json();

  // We sent: msgTextAB (1) + msgTextBA (1) + 5 rapid (5) + spoof attempt (1) = 8 messages
  assert(history.length >= 8, `All messages persisted in database (found ${history.length} messages)`);
  assert(history.some(m => m.content === msgTextAB), 'Original message A → B is persisted in database');
  assert(history.some(m => m.content === msgTextBA), 'Original message B → A is persisted in database');
  assert(history.some(m => m.content === 'Rapid_5'), 'Rapid messages are persisted in database');

  console.log('\n==================================================================');
  console.log(`PHASE 5 REAL-TIME TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  httpServer.close();
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runRealtimeChatTests().catch(err => {
  console.error('Phase 5 Real-Time Test error:', err);
  if (httpServer) httpServer.close();
  process.exit(1);
});
