import { createServer } from 'http';
import express from 'express';
import cors from 'cors';

import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import { createConnectionRouter } from '../routes/connectionRoutes.js';
import { createConversationRouter } from '../routes/conversationRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../middleware/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', createConnectionRouter(null));
app.use('/api/conversations', createConversationRouter(null));
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use(errorHandler);

let server;
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

async function runApiTests() {
  console.log('\n=============================================');
  console.log('🌐 RUNNING HTTP API ROUTE ENDPOINT TEST SUITE');
  console.log('=============================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  const token1 = generateToken(1);
  const token2 = generateToken(2);

  // 1. Health check
  console.log('--- TEST 1: Health & Public Endpoints ---');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert(healthRes.status === 200, 'GET /api/health returns 200 OK');
  const healthJson = await healthRes.json();
  assert(healthJson.status === 'ok', 'Health check status is "ok"');

  // 2. Unauthorized access checks
  console.log('\n--- TEST 2: Strict Authentication & Error Handling ---');
  const noTokenRes = await fetch(`${baseUrl}/api/users/search`);
  assert(noTokenRes.status === 401, 'Request without token returns 401 Unauthorized');
  const noTokenJson = await noTokenRes.json();
  assert(noTokenJson.error.includes('Authentication required'), 'Returns clean error message without stack trace');

  const badTokenRes = await fetch(`${baseUrl}/api/users/search`, {
    headers: { 'Authorization': 'Bearer invalid.token.value' }
  });
  assert(badTokenRes.status === 403, 'Request with bad token returns 403 Forbidden');

  // 3. User Search
  console.log('\n--- TEST 3: GET /api/users/search ---');
  const searchRes = await fetch(`${baseUrl}/api/users/search?q=zenitsu`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  assert(searchRes.status === 200, 'GET /api/users/search returns 200');
  const searchJson = await searchRes.json();
  assert(Array.isArray(searchJson) && searchJson.length > 0, 'Returns array of search results');
  assert(searchJson[0].username === 'agatsuma_zenitsu_2', 'Search result matches target user');

  // 4. User by ID
  console.log('\n--- TEST 4: GET /api/users/:id ---');
  const userRes = await fetch(`${baseUrl}/api/users/2`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  assert(userRes.status === 200, 'GET /api/users/2 returns 200');
  const userJson = await userRes.json();
  assert(userJson.id === 2 && !userJson.password, 'Returns user profile safely without password');

  const notFoundUserRes = await fetch(`${baseUrl}/api/users/99999`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  assert(notFoundUserRes.status === 404, 'GET non-existent user returns 404 Not Found');

  // 5. Connections Flow
  console.log('\n--- TEST 5: Connections API Endpoints ---');
  // Self connection
  const selfConnRes = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: 1 })
  });
  assert(selfConnRes.status === 422, 'Self connection request returns 422 Validation Error');

  // Send request 1 -> 2
  const sendReqRes = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: 2 })
  });
  assert(sendReqRes.status === 201 || sendReqRes.status === 409, 'POST /api/connections/request handled properly');

  // Get requests
  const getReqsRes = await fetch(`${baseUrl}/api/connections/requests`, {
    headers: { 'Authorization': `Bearer ${token2}` }
  });
  assert(getReqsRes.status === 200, 'GET /api/connections/requests returns 200');
  const getReqsJson = await getReqsRes.json();
  assert(Array.isArray(getReqsJson.incoming) && Array.isArray(getReqsJson.outgoing), 'Requests endpoint returns incoming and outgoing arrays');

  // 6. Conversations Flow
  console.log('\n--- TEST 6: Conversations API Endpoints ---');
  const getConvsRes = await fetch(`${baseUrl}/api/conversations`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  assert(getConvsRes.status === 200, 'GET /api/conversations returns 200');
  const getConvsJson = await getConvsRes.json();
  assert(Array.isArray(getConvsJson), 'GET /api/conversations returns array of conversations');

  // Create direct conversation
  const createConvRes = await fetch(`${baseUrl}/api/conversations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 2 })
  });
  assert(createConvRes.status === 200 || createConvRes.status === 201, 'POST /api/conversations returns 200/201');
  const convJson = await createConvRes.json();
  const convId = convJson.id;

  // Send message
  console.log('\n--- TEST 7: Messages API Endpoints ---');
  const sendMsgRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Test message over HTTP REST API' })
  });
  assert(sendMsgRes.status === 201, 'POST /api/conversations/:id/messages returns 201 Created');
  const sendMsgJson = await sendMsgRes.json();
  assert(sendMsgJson.content === 'Test message over HTTP REST API', 'Message content matches payload');
  assert(sendMsgJson.sender_id === 1, 'Server injected authenticated sender_id');

  // Get messages
  const getMsgsRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages?page=1&limit=5`, {
    headers: { 'Authorization': `Bearer ${token1}` }
  });
  assert(getMsgsRes.status === 200, 'GET /api/conversations/:id/messages returns 200 OK');
  assert(getMsgsRes.headers.get('x-total-count') !== null, 'Message history endpoint provides pagination headers');
  const getMsgsJson = await getMsgsRes.json();
  assert(Array.isArray(getMsgsJson) && getMsgsJson.length > 0, 'Returns array of messages');

  // Empty message validation
  const emptyMsgRes = await fetch(`${baseUrl}/api/conversations/${convId}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: '   ' })
  });
  assert(emptyMsgRes.status === 422, 'Empty message returns 422 Validation Error');

  console.log('\n=============================================');
  console.log(`HTTP RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  server.close();
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runApiTests().catch(err => {
  console.error('API Test runner error:', err);
  if (server) server.close();
  process.exit(1);
});
