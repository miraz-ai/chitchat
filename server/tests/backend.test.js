import db from '../db.js';
import { JWT_SECRET, generateToken } from '../middleware/auth.js';
import { UserService } from '../services/userService.js';
import { ConnectionService } from '../services/connectionService.js';
import { ConversationService } from '../services/conversationService.js';
import { MessageService } from '../services/messageService.js';

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

async function runTests() {
  console.log('\n=============================================');
  console.log('🧪 RUNNING BACKEND INTEGRITY & API TEST SUITE');
  console.log('=============================================\n');

  // Wait for DB initialization
  await new Promise(r => setTimeout(r, 200));

  // 1. Check existing users
  console.log('--- TEST 1: Database Users Integrity ---');
  const user1 = await UserService.getUserById(1);
  const user2 = await UserService.getUserById(2);

  assert(user1 !== null, 'User 1 exists in database');
  assert(user2 !== null, 'User 2 exists in database');
  assert(user1.username === 'eren_yeager_1', 'User 1 username matches eren_yeager_1');
  assert(user2.username === 'agatsuma_zenitsu_2', 'User 2 username matches agatsuma_zenitsu_2');
  assert(!user1.password, 'User profile safely omits password hash');

  // 2. Auth Tokens
  console.log('\n--- TEST 2: Authorization & Token Verification ---');
  const token1 = generateToken(1);
  const token2 = generateToken(2);
  assert(typeof token1 === 'string' && token1.length > 20, 'Generated valid JWT for User 1');
  assert(typeof token2 === 'string' && token2.length > 20, 'Generated valid JWT for User 2');

  // 3. User Search
  console.log('\n--- TEST 3: User Search Service ---');
  const searchZenitsu = await UserService.searchUsers(1, 'zenitsu');
  assert(searchZenitsu.length > 0, 'Found user matching query "zenitsu"');
  assert(searchZenitsu[0].id === 2, 'Search result matches User 2 ID');

  const searchSelf = await UserService.searchUsers(1, 'eren');
  assert(!searchSelf.some(u => u.id === 1), 'Search excludes current user from own search results');

  // 4. Connection Request Validation & Integrity
  console.log('\n--- TEST 4: Connection Request Validation & Prevention of Duplicates ---');
  
  // Clean up any existing connection between 1 and 2 for clean test run
  await db.execute(
    'DELETE FROM connections WHERE (requester_id = 1 AND receiver_id = 2) OR (requester_id = 2 AND receiver_id = 1)'
  );

  // Self connection
  try {
    await ConnectionService.sendRequest(1, 1);
    assert(false, 'Should throw error when connecting with self');
  } catch (err) {
    assert(err.statusCode === 422, 'Self-connection properly rejected with 422');
  }

  // Non-existent user
  try {
    await ConnectionService.sendRequest(1, 99999);
    assert(false, 'Should throw error when connecting with non-existent user');
  } catch (err) {
    assert(err.statusCode === 404, 'Connection to non-existent user rejected with 404');
  }

  // Valid request
  const conn = await ConnectionService.sendRequest(1, 2);
  assert(conn && conn.status === 'pending', 'User 1 successfully sent pending connection request to User 2');
  assert(conn.requester_id === 1 && conn.receiver_id === 2, 'Connection record has correct requester and receiver');

  // Duplicate request from same user
  try {
    await ConnectionService.sendRequest(1, 2);
    assert(false, 'Should prevent duplicate connection request');
  } catch (err) {
    assert(err.statusCode === 409, 'Duplicate request prevented with 409 Conflict');
  }

  // Duplicate request in reverse direction
  try {
    await ConnectionService.sendRequest(2, 1);
    assert(false, 'Should prevent reverse duplicate connection request');
  } catch (err) {
    assert(err.statusCode === 409, 'Reverse duplicate request prevented with 409 Conflict');
  }

  // 5. Connection Requests Retrieval
  console.log('\n--- TEST 5: Connection Requests Retrieval ---');
  const reqsUser2 = await ConnectionService.getRequests(2);
  assert(reqsUser2.incoming.length >= 1, 'User 2 has incoming connection request');
  assert(reqsUser2.incoming[0].requester_id === 1, 'Incoming request is from User 1');

  const reqsUser1 = await ConnectionService.getRequests(1);
  assert(reqsUser1.outgoing.length >= 1, 'User 1 has outgoing connection request');
  assert(reqsUser1.outgoing[0].receiver_id === 2, 'Outgoing request is to User 2');

  // 6. Connection Accept & Authorization
  console.log('\n--- TEST 6: Connection Acceptance & Authorization ---');
  
  // Requester (User 1) tries to accept own request -> should fail with 403
  try {
    await ConnectionService.acceptRequest(conn.id, 1);
    assert(false, 'Requester should not be able to accept own request');
  } catch (err) {
    assert(err.statusCode === 403, 'Unauthorized accept rejected with 403 Forbidden');
  }

  // Recipient (User 2) accepts
  const acceptedConn = await ConnectionService.acceptRequest(conn.id, 2);
  assert(acceptedConn.status === 'accepted', 'Recipient (User 2) successfully accepted connection');

  // Verify active connections
  const connsUser1 = await ConnectionService.getConnections(1);
  assert(connsUser1.some(c => c.id === 2), 'User 2 now appears in User 1 active connections');

  const connsUser2 = await ConnectionService.getConnections(2);
  assert(connsUser2.some(c => c.id === 1), 'User 1 now appears in User 2 active connections');

  // 7. Conversation Creation & Integrity
  console.log('\n--- TEST 7: Conversation Creation & Membership ---');

  // Direct conversation with self
  try {
    await ConversationService.getOrCreateDirectConversation(1, 1);
    assert(false, 'Should not allow direct conversation with self');
  } catch (err) {
    assert(err.statusCode === 422, 'Self conversation rejected with 422');
  }

  // Direct conversation between User 1 and User 2
  const directConv = await ConversationService.getOrCreateDirectConversation(1, 2);
  assert(directConv && directConv.type === 'direct', 'Created 1:1 direct conversation');
  assert(directConv.participants.length === 2, 'Conversation has exactly 2 participants');

  // Duplicate direct conversation check
  const duplicateDirect = await ConversationService.getOrCreateDirectConversation(2, 1);
  assert(duplicateDirect.id === directConv.id, 'Idempotent: returns existing direct conversation ID');

  // Group conversation creation
  const groupConv = await ConversationService.createGroupConversation(1, 'Survey Corps Devs', [2]);
  assert(groupConv && groupConv.type === 'group', 'Created group conversation');
  assert(groupConv.name === 'Survey Corps Devs', 'Group conversation has correct name');
  assert(groupConv.participants.length >= 2, 'Group conversation includes both participants');

  // Group conversation validation (empty name)
  try {
    await ConversationService.createGroupConversation(1, '   ', [2]);
    assert(false, 'Should reject empty group name');
  } catch (err) {
    assert(err.statusCode === 422, 'Empty group name rejected with 422');
  }

  // 8. Message Validation, Creation & Sanitization
  console.log('\n--- TEST 8: Message Validation, Creation & Sanitization ---');

  // Empty message
  try {
    await MessageService.createMessage(1, directConv.id, { content: '   ' });
    assert(false, 'Should reject empty message');
  } catch (err) {
    assert(err.statusCode === 422, 'Empty message rejected with 422');
  }

  // Message length limit
  try {
    const hugeMessage = 'a'.repeat(5001);
    await MessageService.createMessage(1, directConv.id, { content: hugeMessage });
    assert(false, 'Should reject message exceeding 5000 characters');
  } catch (err) {
    assert(err.statusCode === 422, 'Overlength message rejected with 422');
  }

  // Unauthorized message (non-existent conversation)
  try {
    await MessageService.createMessage(1, 99999, { content: 'Hello' });
    assert(false, 'Should reject posting to non-existent conversation');
  } catch (err) {
    assert(err.statusCode === 403, 'Posting to non-member conversation rejected with 403');
  }

  // Valid message from User 1
  const msg1 = await MessageService.createMessage(1, directConv.id, {
    content: 'Tatacaw! The backend foundation is ready.',
    type: 'text'
  });
  assert(msg1 && msg1.content === 'Tatacaw! The backend foundation is ready.', 'User 1 sent message successfully');
  assert(msg1.sender_id === 1, 'Message sender_id matches User 1');
  assert(msg1.status === 'sent', 'Message initial status is "sent"');

  // Valid reply from User 2
  const msg2 = await MessageService.createMessage(2, directConv.id, {
    content: 'Thunder breathing first form! Message received.',
    type: 'text'
  });
  assert(msg2 && msg2.sender_id === 2, 'User 2 replied successfully');

  // 9. Message Retrieval & Pagination
  console.log('\n--- TEST 9: Message Retrieval & Pagination ---');
  const feed = await MessageService.getMessages(directConv.id, 1, { page: 1, limit: 10 });
  assert(feed.messages.length >= 2, 'Retrieved message history for conversation');
  const isChronological = feed.messages.every((m, idx, arr) => 
    idx === 0 || m.id >= arr[idx - 1].id || new Date(m.created_at) >= new Date(arr[idx - 1].created_at)
  );
  assert(isChronological, 'Messages returned in chronological order');
  assert(feed.pagination.total >= 2, 'Pagination metadata accurately reports total messages');

  // Non-participant message access check
  // Create a temporary user 4 or use dummy ID 999 to test forbidden access
  try {
    await MessageService.getMessages(directConv.id, 9999);
    assert(false, 'Non-member should not be able to read conversation messages');
  } catch (err) {
    assert(err.statusCode === 403, 'Non-participant reading messages blocked with 403 Forbidden');
  }

  // 10. Read Receipts
  console.log('\n--- TEST 10: Message Read Receipts ---');
  const readResult = await MessageService.markAsRead(directConv.id, 1);
  assert(readResult !== null, 'Marked incoming messages as read for User 1');

  // 11. Conversation List Aggregations
  console.log('\n--- TEST 11: Conversation List Aggregations ---');
  const convList = await ConversationService.getUserConversations(1);
  assert(convList.length >= 2, 'User 1 has both direct and group conversations listed');
  const directInList = convList.find(c => c.id === directConv.id);
  assert(directInList !== undefined, 'Direct conversation present in user conversation list');
  assert(directInList.name === 'Agatsuma Zenitsu', 'Direct conversation dynamically displays recipient name');
  assert(directInList.lastMessage !== null, 'Last message content properly aggregated in conversation item');

  // 12. Connection Cleanup
  console.log('\n--- TEST 12: Connection Deletion ---');
  const delResult = await ConnectionService.deleteConnection(conn.id, 1);
  assert(delResult.success === true, 'Connection successfully deleted by User 1');
  const connsAfterDel = await ConnectionService.getConnections(1);
  assert(!connsAfterDel.some(c => c.connection_id === conn.id), 'Connection no longer in active list');

  // Summary
  console.log('\n=============================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test runner exception:', err);
  process.exit(1);
});
