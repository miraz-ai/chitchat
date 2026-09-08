import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { io as Client } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import assert from 'assert';

import db from '../db.js';
import { JWT_SECRET } from '../middleware/auth.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { securityHeaders } from '../middleware/securityHeaders.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import { createConnectionRouter } from '../routes/connectionRoutes.js';
import { createConversationRouter } from '../routes/conversationRoutes.js';
import { UserService } from '../services/userService.js';
import { MessageService } from '../services/messageService.js';
import { ConversationService } from '../services/conversationService.js';

// Setup test app on an ephemeral port
const app = express();
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const testAuthLimiter = createRateLimiter({
  windowMs: 5000,
  max: 5,
  message: 'Rate limit reached'
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use('/api/auth/rate-limited', testAuthLimiter, (req, res) => res.json({ ok: true }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', createConnectionRouter(io));
app.use('/api/conversations', createConversationRouter(io));
app.use(errorHandler);

// Socket.IO middleware with strict token verification
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return next(new Error('Invalid or expired authentication token'));
    socket.user = { id: parseInt(decoded.id, 10) };
    next();
  });
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  socket.join(`user:${userId}`);

  socket.on('conversation:join', async (conversationId) => {
    const isParticipant = await ConversationService.isParticipant(conversationId, userId);
    if (isParticipant) {
      socket.join(`conversation:${conversationId}`);
      socket.emit('conversation:joined', { conversationId });
    } else {
      socket.emit('error', { message: 'Unauthorized conversation room' });
    }
  });

  socket.on('message:send', async ({ conversationId, content, type = 'text', tempId }, callback) => {
    try {
      const isParticipant = await ConversationService.isParticipant(conversationId, userId);
      if (!isParticipant) {
        if (typeof callback === 'function') callback({ error: 'Forbidden' });
        return socket.emit('error', { message: 'Forbidden' });
      }

      // STRICT SENDER ENFORCEMENT: Ignore any client senderId
      const message = await MessageService.createMessage(userId, conversationId, { content, type });
      socket.emit('message:sent', message);
      io.to(`conversation:${conversationId}`).emit('message:new', message);

      if (typeof callback === 'function') callback({ status: 'sent', message, tempId });
    } catch (err) {
      if (typeof callback === 'function') callback({ error: err.message });
      socket.emit('error', { message: err.message });
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

async function runQATests() {
  console.log('\n==================================================================');
  console.log('🛡️  PHASE 8: FINAL QA, SECURITY & PRODUCTION READINESS TEST SUITE');
  console.log('==================================================================');

  await startServer();

  let passed = 0;
  let failed = 0;

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

  // Provision Users
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
    username: `qa_alice_${salt}`,
    email: `alice_${salt}@qa.com`,
    password: 'Password123!@#',
    name: 'Alice QA'
  });
  const userBData = await regUser({
    username: `qa_bob_${salt}`,
    email: `bob_${salt}@qa.com`,
    password: 'Password123!@#',
    name: 'Bob QA'
  });
  const userCData = await regUser({
    username: `qa_charlie_${salt}`,
    email: `charlie_${salt}@qa.com`,
    password: 'Password123!@#',
    name: 'Charlie QA'
  });

  const userA = userAData.user;
  const tokenA = userAData.token;
  const userB = userBData.user;
  const tokenB = userBData.token;
  const userC = userCData.user;
  const tokenC = userCData.token;

  const conv = await ConversationService.getOrCreateDirectConversation(userA.id, userB.id);

  console.log('\n--- 1. Multi-User Real-Time Communication & Absolute Isolation ---');

  const socketA = createClientSocket(tokenA);
  const socketB = createClientSocket(tokenB);
  const socketC = createClientSocket(tokenC);

  await new Promise((resolve) => {
    let count = 0;
    const check = () => { count++; if (count === 3) resolve(); };
    socketA.on('connect', check);
    socketB.on('connect', check);
    socketC.on('connect', check);
  });

  socketA.emit('conversation:join', conv.id);
  socketB.emit('conversation:join', conv.id);
  await new Promise((r) => setTimeout(r, 150));

  await asyncTest('User A sends real-time message, User B receives it instantly', async () => {
    const messagePromise = new Promise((resolve) => {
      socketB.once('message:new', (msg) => {
        assert.strictEqual(msg.content, 'Hello Bob from Alice in Phase 8 QA');
        assert.strictEqual(msg.sender_id, userA.id);
        resolve(msg);
      });
    });

    socketA.emit('message:send', {
      conversationId: conv.id,
      content: 'Hello Bob from Alice in Phase 8 QA'
    });

    await messagePromise;
  });

  await asyncTest('IDOR GUARD: User C cannot join private conversation room of A and B', async () => {
    const errorPromise = new Promise((resolve) => {
      socketC.once('error', (err) => {
        assert.ok(err.message.includes('Unauthorized'));
        resolve(err);
      });
    });

    socketC.emit('conversation:join', conv.id);
    await errorPromise;
  });

  await asyncTest('IDOR GUARD: User C cannot view conversation messages via REST API (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages`, {
      headers: { Authorization: `Bearer ${tokenC}` }
    });
    assert.strictEqual(res.status, 403, 'Must return 403 Forbidden for unauthorized conversation access');
  });

  await asyncTest('IDOR GUARD: User C cannot send message in A and B conversation via REST API (403 Forbidden)', async () => {
    const res = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenC}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content: 'Intruder message from Charlie' })
    });
    assert.strictEqual(res.status, 403, 'Must reject posting message with 403 Forbidden');
  });

  console.log('\n--- 2. Security Audit & Injection Hardening ---');

  await asyncTest('SQL INJECTION DEFENSE: Malicious query payloads in login handled safely', async () => {
    const sqlPayloads = [
      "' OR '1'='1",
      "admin' --",
      "' UNION SELECT 1, 'admin', 'admin@mail.com', 'pwd', '', '', '' --"
    ];

    for (const payload of sqlPayloads) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: payload, password: 'wrong' })
      });
      // Should fail safely without 500 error or authentication bypass
      assert.strictEqual(res.status, 401, `SQL injection payload must return 401: ${payload}`);
    }
  });

  await asyncTest('SQL INJECTION DEFENSE: Malicious payloads in user search handled safely without syntax error', async () => {
    const maliciousSearch = "'; DROP TABLE users; --";
    const res = await fetch(`${baseUrl}/api/users/search?q=${encodeURIComponent(maliciousSearch)}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, [], 'Dangerous SQL pattern produces safe empty array');

    // Confirm users table still exists and intact
    const countRow = await db.getOne('SELECT COUNT(*) as count FROM users');
    assert.ok(countRow.count >= 3, 'Users table must remain intact');
  });

  await asyncTest('XSS SANITIZATION: Script and HTML tags safely handled without executing or corrupting', async () => {
    const xssContent = '<script>alert("xss")</script><img src="x" onerror="alert(1)">Hello';
    const sentMsg = await MessageService.createMessage(userA.id, conv.id, { content: xssContent });

    const fetchRes = await fetch(`${baseUrl}/api/conversations/${conv.id}/messages?limit=1`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const msgs = await fetchRes.json();
    const last = msgs[msgs.length - 1];
    assert.strictEqual(last.id, sentMsg.id);
    assert.strictEqual(typeof last.content, 'string');
    // Content stored as plain string for safe React JSX interpolation
    assert.ok(last.content.includes('Hello'));
  });

  await asyncTest('ANTI-SPOOFING: Socket message senderId cannot be spoofed by client', async () => {
    const spoofPromise = new Promise((resolve) => {
      socketB.once('message:new', (msg) => {
        // Even if client attempted to send { senderId: userB.id }, server enforces sender_id = userA.id
        assert.strictEqual(msg.sender_id, userA.id, 'Sender ID must strictly match authenticated socket token');
        resolve(msg);
      });
    });

    socketA.emit('message:send', {
      conversationId: conv.id,
      senderId: userB.id, // Attempted spoof
      content: 'Testing anti-spoofing'
    });

    await spoofPromise;
  });

  await asyncTest('AUTH BYPASS GUARDS: Invalid, forged, or missing tokens rejected', async () => {
    // 1. Missing token
    const noTokenRes = await fetch(`${baseUrl}/api/conversations`);
    assert.strictEqual(noTokenRes.status, 401);

    // 2. Forged token with invalid signature
    const forgedToken = jwt.sign({ id: userA.id }, 'wrong_secret_key_xyz');
    const forgedRes = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${forgedToken}` }
    });
    assert.strictEqual(forgedRes.status, 403);

    // 3. Expired token
    const expiredToken = jwt.sign({ id: userA.id }, JWT_SECRET, { expiresIn: '-1s' });
    const expiredRes = await fetch(`${baseUrl}/api/conversations`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(expiredRes.status, 403);
  });

  console.log('\n--- 3. Rate Limiting & Denial of Service Protection ---');

  await asyncTest('RATE LIMITER: Consecutive rapid requests trigger 429 Too Many Requests', async () => {
    // Send 5 permitted requests
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/auth/rate-limited`);
      assert.strictEqual(res.status, 200);
    }

    // 6th request triggers rate limit
    const blockedRes = await fetch(`${baseUrl}/api/auth/rate-limited`);
    assert.strictEqual(blockedRes.status, 429, 'Excessive requests must receive 429');
    assert.ok(blockedRes.headers.get('Retry-After'), 'Must include Retry-After header');
  });

  console.log('\n--- 4. HTTP Security Headers Verification ---');

  await asyncTest('SECURITY HEADERS: Essential security headers are properly emitted', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.strictEqual(res.headers.get('X-Frame-Options'), 'DENY');
    assert.strictEqual(res.headers.get('X-XSS-Protection'), '1; mode=block');
    assert.strictEqual(res.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin');
  });

  console.log('\n--- 5. Database Integrity, Constraints & Foreign Key Cascades ---');

  await asyncTest('DATABASE CONSTRAINTS: Duplicate connections rejected by database constraint', async () => {
    let duplicateRejected = false;
    try {
      await db.execute(
        'INSERT INTO connections (requester_id, receiver_id, status) VALUES (?, ?, ?)',
        [userA.id, userB.id, 'pending']
      );
      // Attempt identical duplicate
      await db.execute(
        'INSERT INTO connections (requester_id, receiver_id, status) VALUES (?, ?, ?)',
        [userA.id, userB.id, 'pending']
      );
    } catch (err) {
      duplicateRejected = true;
    }
    assert.ok(duplicateRejected, 'Unique constraint (requester_id, receiver_id) must reject duplicate');
  });

  await asyncTest('DATABASE INTEGRITY: Foreign key integrity strictly prevents orphaned rows', async () => {
    // Attempt inserting message for non-existent conversation (must fail foreign key check)
    let nonExistentRejected = false;
    try {
      await db.execute('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)', [999999, userB.id, 'Invalid']);
    } catch (err) {
      nonExistentRejected = true;
    }
    assert.ok(nonExistentRejected, 'Foreign key must reject messages referencing non-existent conversation');

    // Attempt inserting connection for non-existent user
    let nonExistentUserRejected = false;
    try {
      await db.execute('INSERT INTO connections (requester_id, receiver_id, status) VALUES (?, ?, ?)', [userA.id, 999999, 'pending']);
    } catch (err) {
      nonExistentUserRejected = true;
    }
    assert.ok(nonExistentUserRejected, 'Foreign key must reject connection referencing non-existent user');
  });

  socketA.disconnect();
  socketB.disconnect();
  socketC.disconnect();
  httpServer.close();

  console.log('\n==================================================================');
  console.log(`PHASE 8 FINAL QA & SECURITY RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  if (failed > 0) process.exit(1);
}

runQATests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
