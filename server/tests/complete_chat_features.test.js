import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import assert from 'assert';

import db from '../db.js';

const get = (sql, params) => db.getOne(sql, params);
const all = (sql, params) => db.query(sql, params);
const run = (sql, params) => db.execute(sql, params);
import { JWT_SECRET } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';
import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import { createConnectionRouter } from '../routes/connectionRoutes.js';
import { createConversationRouter } from '../routes/conversationRoutes.js';
import { UserService } from '../services/userService.js';
import { MessageService } from '../services/messageService.js';
import { ConversationService } from '../services/conversationService.js';

// Setup test server on an ephemeral port
const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', createConnectionRouter(io));
app.use('/api/conversations', createConversationRouter(io));
app.use(errorHandler);

// Socket.IO Auth & handlers matching server/index.js
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
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
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
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
    const isParticipant = await ConversationService.isParticipant(conversationId, userId);
    if (isParticipant) {
      socket.join(`conversation:${conversationId}`);
    } else {
      socket.emit('error', { message: 'Unauthorized conversation room' });
    }
  });

  socket.on('conversation:leave', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  socket.on('message:send', async ({ conversationId, content, type = 'text', tempId }, callback) => {
    try {
      const isParticipant = await ConversationService.isParticipant(conversationId, userId);
      if (!isParticipant) {
        if (typeof callback === 'function') callback({ error: 'Forbidden' });
        return socket.emit('error', { message: 'Forbidden' });
      }

      const message = await MessageService.createMessage(userId, conversationId, { content, type });
      socket.emit('message:sent', message);
      io.to(`conversation:${conversationId}`).emit('message:new', message);

      if (typeof callback === 'function') callback({ status: 'sent', message, tempId });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('message:delivered', async ({ messageId, conversationId }) => {
    try {
      await MessageService.markAsDelivered(messageId, userId);
      const deliveredAt = new Date().toISOString();
      io.to(`conversation:${conversationId}`).emit('message:update', {
        messageId,
        conversationId,
        status: 'delivered',
        deliveredAt
      });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('message:read', async ({ messageId, conversationId }) => {
    try {
      await MessageService.markAsRead(conversationId, userId);
      const readAt = new Date().toISOString();
      io.to(`conversation:${conversationId}`).emit('message:update', {
        messageId,
        conversationId,
        status: 'read',
        readAt
      });
    } catch (e) {
      console.error(e);
    }
  });

  socket.on('typing:start', async ({ conversationId }) => {
    const isParticipant = await ConversationService.isParticipant(conversationId, userId);
    if (isParticipant) {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId });
    }
  });

  socket.on('typing:stop', async ({ conversationId }) => {
    const isParticipant = await ConversationService.isParticipant(conversationId, userId);
    if (isParticipant) {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId });
    }
  });

  socket.on('message:edit', async ({ messageId, conversationId, content }, callback) => {
    try {
      const isParticipant = await ConversationService.isParticipant(conversationId, userId);
      if (!isParticipant) {
        if (typeof callback === 'function') callback({ error: 'Forbidden' });
        return;
      }
      const updated = await MessageService.editMessage(messageId, userId, content);
      io.to(`conversation:${conversationId}`).emit('message:edited', {
        messageId: updated.id,
        conversationId: updated.conversation_id,
        content: updated.content,
        isEdited: true,
        updatedAt: updated.updated_at
      });
      if (typeof callback === 'function') callback({ status: 'ok', message: updated });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });

  socket.on('message:delete', async ({ messageId, conversationId }, callback) => {
    try {
      const isParticipant = await ConversationService.isParticipant(conversationId, userId);
      if (!isParticipant) {
        if (typeof callback === 'function') callback({ error: 'Forbidden' });
        return;
      }
      await MessageService.deleteMessage(messageId, userId);
      io.to(`conversation:${conversationId}`).emit('message:deleted', {
        messageId,
        conversationId
      });
      if (typeof callback === 'function') callback({ status: 'ok' });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
    }
  });
});

let testPort;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    httpServer.listen(0, () => {
      testPort = httpServer.address().port;
      baseUrl = `http://localhost:${testPort}`;
      resolve();
    });
  });
}

function createClientSocket(token) {
  return Client(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });
}

async function runCompleteFeaturesTests() {
  console.log('\n==================================================================');
  console.log('🚀 PHASE 6: COMPLETE CHAT FEATURES TEST SUITE');
  console.log('==================================================================');

  await startServer();

  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  async function asyncTest(desc, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     ${err.message}`);
      failed++;
    }
  }

  // Register 3 unique test users
  const salt = Date.now().toString().slice(-6);
  const regUser = async (user) => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    return await res.json();
  };

  const userAData = await regUser({
    username: `p6_alice_${salt}`,
    email: `alice_${salt}@chat.com`,
    password: 'Password123!@#',
    name: 'Alice P6'
  });
  const userBData = await regUser({
    username: `p6_bob_${salt}`,
    email: `bob_${salt}@chat.com`,
    password: 'Password123!@#',
    name: 'Bob P6'
  });
  const userCData = await regUser({
    username: `p6_charlie_${salt}`,
    email: `charlie_${salt}@chat.com`,
    password: 'Password123!@#',
    name: 'Charlie P6'
  });

  const userA = userAData.user;
  const tokenA = userAData.token;
  const userB = userBData.user;
  const tokenB = userBData.token;
  const userC = userCData.user;
  const tokenC = userCData.token;

  const conv = await ConversationService.getOrCreateDirectConversation(userA.id, userB.id);

  console.log('\n--- 1. Message History & Pagination (cursor pagination with limit=30 and before) ---');

  // Seed 45 messages
  const messageIds = [];
  for (let i = 1; i <= 45; i++) {
    const sender = i % 2 === 0 ? userB.id : userA.id;
    const msg = await MessageService.createMessage(sender, conv.id, { content: `Message number ${i}` });
    messageIds.push(msg.id);
  }

  await asyncTest('Initial fetch with limit=30 returns latest 30 messages with pagination headers', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages?limit=30`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res.status, 200);
    const hasMore = res.headers.get('X-Has-More');
    const oldestId = res.headers.get('X-Oldest-Id');
    assert.strictEqual(hasMore, 'true');
    assert.ok(oldestId, 'Oldest ID header should be present');

    const messages = await res.json();
    assert.strictEqual(messages.length, 30);
    // Chronological order: first in array is message 16, last is message 45
    assert.strictEqual(messages[messages.length - 1].content, 'Message number 45');
    assert.strictEqual(messages[0].content, 'Message number 16');
  });

  await asyncTest('Paginated format response returns structured metadata object', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages?limit=30&format=paginated`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(body.pagination);
    assert.strictEqual(body.pagination.limit, 30);
    assert.strictEqual(body.pagination.hasMore, true);
    assert.strictEqual(body.messages.length, 30);
  });

  await asyncTest('Cursor fetch with before={oldestId} loads remaining 15 older messages', async () => {
    // First get oldestId of first page
    const firstPageRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages?limit=30`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const oldestId = firstPageRes.headers.get('X-Oldest-Id');

    // Fetch older page
    const olderRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages?limit=30&before=${oldestId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(olderRes.status, 200);
    const hasMore = olderRes.headers.get('X-Has-More');
    assert.strictEqual(hasMore, 'false', 'hasMore should be false on reaching beginning');

    const olderMessages = await olderRes.json();
    assert.strictEqual(olderMessages.length, 15);
    assert.strictEqual(olderMessages[0].content, 'Message number 1');
    assert.strictEqual(olderMessages[olderMessages.length - 1].content, 'Message number 15');
  });

  console.log('\n--- 2. Unread Messages & Real-Time Badge Increments ---');

  let testMsgId;
  await asyncTest('Unread count increments in conversation list for recipient', async () => {
    // Send 2 fresh unread messages from User A to User B
    const msg1 = await MessageService.createMessage(userA.id, conv.id, { content: 'Unread ping 1' });
    const msg2 = await MessageService.createMessage(userA.id, conv.id, { content: 'Unread ping 2' });
    testMsgId = msg2.id;

    // Check User B conversation list
    const resB = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const convsB = await resB.json();
    const targetConv = convsB.find((c) => c.id === conv.id);
    assert.ok(targetConv, 'Target conversation exists');
    assert.ok(targetConv.unreadCount >= 2, `Unread count should be at least 2, got ${targetConv.unreadCount}`);
  });

  await asyncTest('Marking conversation as read resets unread count to 0 and persists read_at', async () => {
    const readRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(readRes.status, 200);

    // Verify unread count is now 0 for User B
    const convsAfter = await (await fetch(`${baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    })).json();
    const targetAfter = convsAfter.find((c) => c.id === conv.id);
    assert.strictEqual(targetAfter.unreadCount, 0, 'Unread count should be 0 after marking read');

    // Verify database has read status and read_at timestamp
    const row = await get('SELECT status, read_at FROM messages WHERE id = ?', [testMsgId]);
    assert.strictEqual(row.status, 'read');
    assert.ok(row.read_at, 'read_at timestamp must be populated in DB');
  });

  console.log('\n--- 3. Delivery Status Lifecycle & Stamped Timestamps ---');

  const socketA = createClientSocket(tokenA);
  const socketB = createClientSocket(tokenB);

  await new Promise((resolve) => {
    let count = 0;
    const check = () => { count++; if (count === 2) resolve(); };
    socketA.on('connect', check);
    socketB.on('connect', check);
  });

  socketA.emit('conversation:join', conv.id);
  socketB.emit('conversation:join', conv.id);
  await new Promise((r) => setTimeout(r, 200));

  await asyncTest('Message delivery lifecycle: sent -> delivered -> read with real timestamps', async () => {
    // User A sends message
    const sendResult = await new Promise((resolve) => {
      socketA.emit('message:send', { conversationId: conv.id, content: 'Delivery lifecycle test' }, (res) => {
        resolve(res);
      });
    });

    assert.strictEqual(sendResult.status, 'sent');
    assert.ok(sendResult.message.id);
    const sentMsgId = sendResult.message.id;

    // User B reports delivered
    const deliveredPromise = new Promise((resolve) => {
      socketA.on('message:update', (update) => {
        if (update.messageId === sentMsgId && update.status === 'delivered') {
          assert.ok(update.deliveredAt, 'Must include real deliveredAt timestamp');
          resolve(update);
        }
      });
    });
    socketB.emit('message:delivered', { messageId: sentMsgId, conversationId: conv.id });
    await deliveredPromise;

    // User B reports read
    const readPromise = new Promise((resolve) => {
      socketA.on('message:update', (update) => {
        if (update.messageId === sentMsgId && update.status === 'read') {
          assert.ok(update.readAt, 'Must include real readAt timestamp');
          resolve(update);
        }
      });
    });
    socketB.emit('message:read', { messageId: sentMsgId, conversationId: conv.id });
    await readPromise;
  });

  console.log('\n--- 4. Typing Indicators & In-Memory Ephemeral Events ---');

  await asyncTest('Typing indicator broadcasts without persisting any rows to DB', async () => {
    const msgCountBefore = (await get('SELECT COUNT(*) as cnt FROM messages')).cnt;

    const typingStartPromise = new Promise((resolve) => {
      socketB.once('typing:start', (data) => {
        assert.strictEqual(data.conversationId.toString(), conv.id.toString());
        assert.strictEqual(data.userId, userA.id);
        resolve(data);
      });
    });

    socketA.emit('typing:start', { conversationId: conv.id });
    await typingStartPromise;

    const typingStopPromise = new Promise((resolve) => {
      socketB.once('typing:stop', (data) => {
        assert.strictEqual(data.conversationId.toString(), conv.id.toString());
        assert.strictEqual(data.userId, userA.id);
        resolve(data);
      });
    });

    socketA.emit('typing:stop', { conversationId: conv.id });
    await typingStopPromise;

    const msgCountAfter = (await get('SELECT COUNT(*) as cnt FROM messages')).cnt;
    assert.strictEqual(msgCountBefore, msgCountAfter, 'Typing indicators must NOT write to database');
  });

  console.log('\n--- 5. Message Editing: Own Message vs 403 Forbidden Guard ---');

  let editableMsgId;
  await asyncTest('User A successfully edits own message and sets is_edited and updated_at', async () => {
    const origMsg = await MessageService.createMessage(userA.id, conv.id, { content: 'Original message before edit' });
    editableMsgId = origMsg.id;

    const editRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages/${editableMsgId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: 'Edited content by Alice' })
    });
    assert.strictEqual(editRes.status, 200);
    const editedMsg = await editRes.json();
    assert.strictEqual(editedMsg.content, 'Edited content by Alice');
    assert.strictEqual(editedMsg.is_edited, 1);
    assert.ok(editedMsg.updated_at, 'updated_at must be populated');

    // DB verification
    const dbRow = await get('SELECT content, is_edited, updated_at FROM messages WHERE id = ?', [editableMsgId]);
    assert.strictEqual(dbRow.content, 'Edited content by Alice');
    assert.strictEqual(dbRow.is_edited, 1);
  });

  await asyncTest('SECURITY GUARD: User B editing User A message rejected with 403 Forbidden', async () => {
    const maliciousEditRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages/${editableMsgId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenB}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: 'Hacked by Bob' })
    });
    assert.strictEqual(maliciousEditRes.status, 403, 'Should reject modifying others message with 403 Forbidden');

    // Verify content uncorrupted
    const dbRow = await get('SELECT content FROM messages WHERE id = ?', [editableMsgId]);
    assert.strictEqual(dbRow.content, 'Edited content by Alice');
  });

  await asyncTest('Real-time socket broadcast on message:edit', async () => {
    const editedPromise = new Promise((resolve) => {
      socketB.once('message:edited', (event) => {
        assert.strictEqual(event.messageId.toString(), editableMsgId.toString());
        assert.strictEqual(event.content, 'Edited via socket by Alice');
        assert.strictEqual(event.isEdited, true);
        resolve(event);
      });
    });

    socketA.emit('message:edit', {
      messageId: editableMsgId,
      conversationId: conv.id,
      content: 'Edited via socket by Alice'
    });

    await editedPromise;
  });

  console.log('\n--- 6. Message Deletion: Own Message vs 403 Forbidden Guard ---');

  let deletableMsgId;
  await asyncTest('SECURITY GUARD: User B deleting User A message rejected with 403 Forbidden', async () => {
    const msg = await MessageService.createMessage(userA.id, conv.id, { content: 'Message for delete test' });
    deletableMsgId = msg.id;

    const maliciousDeleteRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages/${deletableMsgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert.strictEqual(maliciousDeleteRes.status, 403, 'Should reject deleting others message with 403 Forbidden');

    // Verify message still exists
    const row = await get('SELECT id FROM messages WHERE id = ?', [deletableMsgId]);
    assert.ok(row, 'Message must still exist');
  });

  await asyncTest('User A deletes own message via DELETE endpoint with socket broadcast', async () => {
    const deletePromise = new Promise((resolve) => {
      socketB.once('message:deleted', (event) => {
        assert.strictEqual(event.messageId.toString(), deletableMsgId.toString());
        assert.strictEqual(event.conversationId.toString(), conv.id.toString());
        resolve(event);
      });
    });

    const delRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages/${deletableMsgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(delRes.status, 200);

    await deletePromise;

    // Verify removed from DB
    const row = await get('SELECT id FROM messages WHERE id = ?', [deletableMsgId]);
    assert.strictEqual(row, null, 'Message must be deleted from DB');

    socketA.disconnect();
    socketB.disconnect();
  });

  console.log('\n--- 7. Empty States & Boundary Conditions ---');

  await asyncTest('User C with 0 conversations receives clean empty array []', async () => {
    const res = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    assert.strictEqual(res.status, 200);
    const convs = await res.json();
    assert.deepStrictEqual(convs, []);
  });

  await asyncTest('Fresh conversation with 0 messages receives clean empty array []', async () => {
    const emptyConv = await ConversationService.getOrCreateDirectConversation(userA.id, userC.id);
    const res = await fetch(`${baseUrl}/api/conversations/${emptyConv.id}/messages`, {
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    assert.strictEqual(res.status, 200);
    const msgs = await res.json();
    assert.deepStrictEqual(msgs, []);
  });

  await asyncTest('User search with non-existent query returns clean empty array []', async () => {
    const res = await fetch(`${baseUrl}/api/users/search?q=xyznonexistentuser999`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res.status, 200);
    const results = await res.json();
    assert.deepStrictEqual(results, []);
  });

  console.log('\n--- 8. Reconnect & Network Offline Message Persistence ---');

  await asyncTest('Messages sent while recipient is offline are persisted and available upon reconnection', async () => {
    // User B is currently offline (no sockets connected)
    const offlineMsg = await MessageService.createMessage(userA.id, conv.id, { content: 'Message sent while Bob is offline' });

    // Verify User A can fetch it from DB
    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages?limit=10`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const msgs = await res.json();
    const found = msgs.find((m) => m.id === offlineMsg.id);
    assert.ok(found, 'Message sent while recipient offline must persist');
    assert.strictEqual(found.content, 'Message sent while Bob is offline');

    // When Bob reconnects and requests messages, he receives it
    const resB = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages?limit=10`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    const msgsB = await resB.json();
    const foundB = msgsB.find((m) => m.id === offlineMsg.id);
    assert.ok(foundB, 'Bob receives offline message upon reconnecting');
  });

  console.log('\n==================================================================');
  console.log(`PHASE 6 COMPLETE CHAT FEATURES RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  httpServer.close();
  if (failed > 0) process.exit(1);
}

runCompleteFeaturesTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
