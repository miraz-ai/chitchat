import { createServer } from 'http';
import express from 'express';
import cors from 'cors';

import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import { createConnectionRouter } from '../routes/connectionRoutes.js';
import { createConversationRouter } from '../routes/conversationRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../middleware/auth.js';
import { ConnectionService } from '../services/connectionService.js';
import { ConversationService } from '../services/conversationService.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', createConnectionRouter(null));
app.use('/api/conversations', createConversationRouter(null));
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

async function runPhase4Tests() {
  console.log('\n==================================================================');
  console.log('🤝 PHASE 4: CONNECTIONS AND CONVERSATIONS TEST SUITE');
  console.log('==================================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  const runId = Date.now().toString().slice(-6);

  // Helper to register users
  const registerUser = async (u) => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(u)
    });
    return await res.json();
  };

  // 1. Setup Test Users: User A, User B, and unauthorized User C
  console.log('--- TEST 1: Provision Test Users ---');
  const userAData = await registerUser({
    username: `user_a_${runId}`,
    name: 'Alice Zuberg',
    email: `alice_${runId}@underworld.io`,
    password: 'Password123!@#'
  });
  const userBData = await registerUser({
    username: `user_b_${runId}`,
    name: 'Eugeo Synthesis',
    email: `eugeo_${runId}@underworld.io`,
    password: 'Password123!@#'
  });
  const userCData = await registerUser({
    username: `user_c_${runId}`,
    name: 'Quinella Administrator',
    email: `quinella_${runId}@cathedral.gov`,
    password: 'Password123!@#'
  });

  const userA = userAData.user;
  const tokenA = userAData.token;
  const userB = userBData.user;
  const tokenB = userBData.token;
  const userC = userCData.user;
  const tokenC = userCData.token;

  assert(userA && userA.id, 'User A registered successfully');
  assert(userB && userB.id, 'User B registered successfully');
  assert(userC && userC.id, 'User C registered successfully');

  // 2. Connection Requests & Prevention Rules
  console.log('\n--- TEST 2: Connection Request Validation & Edge Cases ---');
  // Self connection
  const selfRes = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: userA.id })
  });
  assert(selfRes.status === 422, 'Self-connection properly rejected with 422 Unprocessable Entity');

  // User A -> request User B
  const reqRes = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: userB.id })
  });
  assert(reqRes.status === 201, 'User A successfully sent connection request to User B (201 Created)');
  const initialConnection = await reqRes.json();
  assert(initialConnection.status === 'pending', 'Connection status is initially "pending"');

  // Duplicate request User A -> User B
  const dupReqRes = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: userB.id })
  });
  assert(dupReqRes.status === 409, 'Duplicate request prevented with 409 Conflict');

  // Reverse duplicate request User B -> User A
  const revReqRes = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: userA.id })
  });
  assert(revReqRes.status === 409, 'Reverse duplicate request prevented with 409 Conflict');

  // 3. Request Cancellation Flow
  console.log('\n--- TEST 3: Connection Cancellation & State Transitions ---');
  // User C trying to cancel A's request
  const unauthCancelRes = await fetch(`${baseUrl}/api/connections/${initialConnection.id}/cancel`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenC}` }
  });
  assert(unauthCancelRes.status === 403, 'Unauthorized user canceling request rejected with 403 Forbidden');

  // User A canceling own request
  const cancelRes = await fetch(`${baseUrl}/api/connections/${initialConnection.id}/cancel`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(cancelRes.status === 200, 'User A successfully cancelled pending connection request (200 OK)');

  // Verify connection is removed
  const searchAfterCancel = await fetch(`${baseUrl}/api/users/search?q=${userB.username}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const searchData1 = await searchAfterCancel.json();
  assert(searchData1[0].connection_status === 'not_connected', 'Connection state reset to "not_connected" after cancellation');

  // 4. Rejection Flow
  console.log('\n--- TEST 4: Rejection & Re-request Flow ---');
  // Send request again: A -> B
  const reqRes2 = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: userB.id })
  });
  const conn2 = await reqRes2.json();

  // User C trying to reject
  const unauthRejectRes = await fetch(`${baseUrl}/api/connections/${conn2.id}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenC}` }
  });
  assert(unauthRejectRes.status === 403, 'Unauthorized user rejecting request rejected with 403 Forbidden');

  // User B rejects A's request
  const rejectRes = await fetch(`${baseUrl}/api/connections/${conn2.id}/reject`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(rejectRes.status === 200, 'User B successfully rejected connection request (200 OK)');

  // Verify rejection state in search
  const searchAfterReject = await fetch(`${baseUrl}/api/users/search?q=${userB.username}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const searchData2 = await searchAfterReject.json();
  assert(searchData2[0].connection_status === 'rejected', 'Connection state updated to "rejected"');

  // Re-requesting after rejection should reopen as pending
  const reRequestRes = await fetch(`${baseUrl}/api/connections/request`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receiverId: userB.id })
  });
  assert(reRequestRes.status === 200 || reRequestRes.status === 201, 'Re-requesting after rejection succeeds');
  const activeConnRecord = await reRequestRes.json();

  // 5. Acceptance Flow & 5 Connection States
  console.log('\n--- TEST 5: Acceptance & 5 Connection States Verification ---');
  // Check User A's view: status = 'pending'
  const searchForBFromA = await fetch(`${baseUrl}/api/users/search?q=${userB.username}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const stateFromA = (await searchForBFromA.json())[0];
  assert(stateFromA.connection_status === 'pending', 'User A sees state as "pending" (outgoing)');

  // Check User B's view: status = 'incoming_request'
  const searchForAFromB = await fetch(`${baseUrl}/api/users/search?q=${userA.username}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const stateFromB = (await searchForAFromB.json())[0];
  assert(stateFromB.connection_status === 'incoming_request', 'User B sees state as "incoming_request" (incoming)');

  // User B accepts request
  const acceptRes = await fetch(`${baseUrl}/api/connections/${activeConnRecord.id}/accept`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(acceptRes.status === 200, 'User B accepted connection request (200 OK)');

  // Check states after acceptance: both see 'connected'
  const searchAcceptedA = await fetch(`${baseUrl}/api/users/search?q=${userB.username}`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert((await searchAcceptedA.json())[0].connection_status === 'connected', 'User A now sees state as "connected"');

  const searchAcceptedB = await fetch(`${baseUrl}/api/users/search?q=${userA.username}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert((await searchAcceptedB.json())[0].connection_status === 'connected', 'User B now sees state as "connected"');

  // Check Connections List API
  const getConnARes = await fetch(`${baseUrl}/api/connections`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const connsA = await getConnARes.json();
  assert(connsA.some(c => c.id === userB.id), 'User B appears in User A active connections list');

  const getConnBRes = await fetch(`${baseUrl}/api/connections`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const connsB = await getConnBRes.json();
  assert(connsB.some(c => c.id === userA.id), 'User A appears in User B active connections list');

  // 6. Conversation Creation & Deduplication
  console.log('\n--- TEST 6: Conversation Creation & Deduplication ---');
  // User A creates conversation with User B
  const createConvRes1 = await fetch(`${baseUrl}/api/conversations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userB.id })
  });
  assert(createConvRes1.status === 201 || createConvRes1.status === 200, 'User A created direct conversation with User B');
  const conv1 = await createConvRes1.json();
  assert(conv1.id && conv1.type === 'direct', 'Created valid direct conversation');

  // User B accesses same conversation
  const getConvBRes = await fetch(`${baseUrl}/api/conversations/${conv1.id}`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(getConvBRes.status === 200, 'User B successfully accessed the same conversation (200 OK)');
  const conv1FromB = await getConvBRes.json();
  assert(conv1FromB.id === conv1.id, 'Retrieved conversation ID matches conv1');

  // User B creates conversation with User A -> MUST RETURN EXACT SAME CONVERSATION
  const createConvRes2 = await fetch(`${baseUrl}/api/conversations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userA.id })
  });
  const conv2 = await createConvRes2.json();
  assert(conv2.id === conv1.id, 'DEDUPLICATION VERIFIED: User B + User A resolves to same conversation ID');

  // Multiple repeated creations always resolve to same ID
  const repeatRes = await fetch(`${baseUrl}/api/conversations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: userB.id })
  });
  const convRepeat = await repeatRes.json();
  assert(convRepeat.id === conv1.id, 'Idempotent creation returns existing conversation');

  // 7. Conversation List Formatting
  console.log('\n--- TEST 7: Conversation List Response Formatting ---');
  // User A sends message
  await fetch(`${baseUrl}/api/conversations/${conv1.id}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Stay cool, Eugeo.' })
  });

  const convListRes = await fetch(`${baseUrl}/api/conversations`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  assert(convListRes.status === 200, 'GET /api/conversations returns 200');
  const convList = await convListRes.json();
  const targetConvItem = convList.find(c => c.id === conv1.id);
  assert(targetConvItem !== undefined, 'Target conversation exists in conversation list');
  assert(targetConvItem.otherUser && targetConvItem.otherUser.id === userA.id, 'Includes otherUser profile matching User A');
  assert(targetConvItem.otherUser.username === userA.username, 'otherUser includes username');
  assert(targetConvItem.otherUser.email === undefined, 'otherUser profile strictly omits private email');
  assert(targetConvItem.lastMessage === 'Stay cool, Eugeo.', 'Includes lastMessage matching sent message');
  assert(targetConvItem.lastMessageTimestamp !== undefined, 'Includes lastMessageTimestamp');
  assert(targetConvItem.unreadCount === 1, 'Accurately computes unreadCount for recipient (1 unread)');
  assert(targetConvItem.status !== undefined, 'Includes online status');

  // 8. Authorization Guards
  console.log('\n--- TEST 8: Strict Authorization & Security Guards ---');
  // User C attempting to view conversation 1
  const unauthViewConvRes = await fetch(`${baseUrl}/api/conversations/${conv1.id}`, {
    headers: { 'Authorization': `Bearer ${tokenC}` }
  });
  assert(unauthViewConvRes.status === 403, 'Unauthorized user viewing conversation rejected with 403 Forbidden');

  // User C attempting to view messages in conversation 1
  const unauthViewMessagesRes = await fetch(`${baseUrl}/api/conversations/${conv1.id}/messages`, {
    headers: { 'Authorization': `Bearer ${tokenC}` }
  });
  assert(unauthViewMessagesRes.status === 403, 'Unauthorized user reading messages rejected with 403 Forbidden');

  // User C attempting to send message in conversation 1
  const unauthSendMessageRes = await fetch(`${baseUrl}/api/conversations/${conv1.id}/messages`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Hacked message' })
  });
  assert(unauthSendMessageRes.status === 403, 'Unauthorized user sending message rejected with 403 Forbidden');

  // 9. Connection Removal
  console.log('\n--- TEST 9: Connection Removal ---');
  const removeRes = await fetch(`${baseUrl}/api/connections/${activeConnRecord.id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  assert(removeRes.status === 200, 'User A successfully removed connection (200 OK)');

  const verifyRemovedRes = await fetch(`${baseUrl}/api/connections`, {
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const finalConns = await verifyRemovedRes.json();
  assert(!finalConns.some(c => c.id === userB.id), 'Connection removed from active connections list');

  console.log('\n==================================================================');
  console.log(`PHASE 4 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================================\n');

  server.close();
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runPhase4Tests().catch(err => {
  console.error('Phase 4 Test error:', err);
  if (server) server.close();
  process.exit(1);
});
