import { createServer } from 'http';
import express from 'express';
import cors from 'cors';

import authRoutes from '../routes/authRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import { createConnectionRouter } from '../routes/connectionRoutes.js';
import { createConversationRouter } from '../routes/conversationRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../middleware/auth.js';
import { UserService } from '../services/userService.js';

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

async function runAuthUserTests() {
  console.log('\n======================================================');
  console.log('🔒 PHASE 3: AUTHENTICATION & USER SYSTEM TEST SUITE');
  console.log('======================================================\n');

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });

  // Unique timestamp to allow multiple test runs without collision
  const testId = Date.now().toString().slice(-6);
  const testUser = {
    username: `testuser_${testId}`,
    name: 'Mikasa Ackerman',
    email: `mikasa_${testId}@scouts.org`,
    password: 'Password123!@#'
  };

  // 1. Registration Flow
  console.log('--- TEST 1: User Registration ---');
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testUser)
  });
  assert(regRes.status === 201, 'Registration returns 201 Created');
  const regData = await regRes.json();
  assert(regData.token && regData.token.length > 20, 'Registration returns valid JWT');
  assert(regData.user.username === testUser.username, 'User profile has correct username');
  assert(regData.user.name === testUser.name, 'User profile has correct name');
  assert(regData.user.email === testUser.email, 'User profile has correct email');
  assert(regData.user.avatar.includes('ui-avatars.com'), 'Default avatar auto-generated on registration');
  assert(!regData.user.password, 'Password hash is NOT exposed in response');

  const registeredUserId = regData.user.id;
  const userToken = regData.token;

  // Duplicate registration rejection
  const dupEmailRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `another_${testId}`,
      name: 'Another Name',
      email: testUser.email,
      password: 'Password123!@#'
    })
  });
  assert(dupEmailRes.status === 409, 'Duplicate email registration rejected with 409 Conflict');

  const dupUserRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUser.username,
      name: 'Another Name',
      email: `diff_${testId}@scouts.org`,
      password: 'Password123!@#'
    })
  });
  assert(dupUserRes.status === 409, 'Duplicate username registration rejected with 409 Conflict');

  // Strict Password Policy Rejection
  const weakPassRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `weak_${testId}`,
      name: 'Weak Pass',
      email: `weak_${testId}@test.com`,
      password: 'weak'
    })
  });
  assert(weakPassRes.status === 422, 'Weak password rejected with 422 Validation Error');

  // 2. Login Flow
  console.log('\n--- TEST 2: User Login & Session Token ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUser.email,
      password: testUser.password
    })
  });
  assert(loginRes.status === 200, 'Valid credentials login returns 200 OK');
  const loginData = await loginRes.json();
  assert(loginData.token && loginData.token.length > 20, 'Login issues signed JWT');
  assert(loginData.user.id === registeredUserId, 'Login user ID matches registered user');

  // Invalid password login
  const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testUser.email,
      password: 'WrongPassword999!'
    })
  });
  assert(badLoginRes.status === 401, 'Invalid password rejected with 401 Unauthorized');

  // 3. Session Persistence (GET /api/auth/me)
  console.log('\n--- TEST 3: Session Persistence (/api/auth/me) ---');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(meRes.status === 200, 'GET /api/auth/me returns 200 with valid token');
  const meData = await meRes.json();
  assert(meData.user.id === registeredUserId, 'Session accurately identifies authenticated user');
  assert(!meData.user.password, 'Session payload does not leak password');

  // Without token
  const noAuthMeRes = await fetch(`${baseUrl}/api/auth/me`);
  assert(noAuthMeRes.status === 401, 'GET /api/auth/me without token returns 401');

  // 4. User Profile Update (Own Profile)
  console.log('\n--- TEST 4: Profile Editing (Own Profile) ---');
  const updateRes = await fetch(`${baseUrl}/api/auth/profile`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Mikasa Ackerman (Survey Corps Leader)',
      email: testUser.email,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
      bio: 'If we win, we live. If we lose, we die. If we don’t fight, we cannot win!'
    })
  });
  assert(updateRes.status === 200, 'Profile update returns 200 OK');
  const updateData = await updateRes.json();
  assert(updateData.user.name.includes('Survey Corps Leader'), 'Updated name persisted');
  assert(updateData.user.bio.includes('If we win'), 'Updated bio persisted in database');

  // 5. User Permissions: Prevention of Unauthorized Profile Modification & Private Data Protection
  console.log('\n--- TEST 5: User Permissions & Private Data Protection ---');
  // User 1 trying to edit Mikasa's profile via PUT /api/users/:id
  const user1Token = generateToken(1);
  const maliciousUpdateRes = await fetch(`${baseUrl}/api/users/${registeredUserId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${user1Token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Hacked Name By User 1',
      email: 'hacked@test.com'
    })
  });
  assert(maliciousUpdateRes.status === 403, 'User A modifying User B profile rejected with 403 Forbidden');

  // Verify Mikasa's profile remains untouched
  const verifyUntouchedRes = await fetch(`${baseUrl}/api/users/${registeredUserId}`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const verifiedUser = await verifyUntouchedRes.json();
  assert(!verifiedUser.name.includes('Hacked'), 'User profile integrity strictly protected against cross-user edits');

  // Verify User A cannot access User B's private email
  const crossUserViewRes = await fetch(`${baseUrl}/api/users/${registeredUserId}`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  const crossUserView = await crossUserViewRes.json();
  assert(crossUserView.email === undefined, 'User A cannot access User B private email via public profile');
  assert(crossUserView.name !== undefined, 'User A can view User B public name');
  assert(crossUserView.avatar !== undefined, 'User A can view User B public avatar');

  // Verify User can access their own email on their own profile
  const ownProfileRes = await fetch(`${baseUrl}/api/users/${registeredUserId}`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  const ownProfile = await ownProfileRes.json();
  assert(ownProfile.email === testUser.email, 'User can view their own private email on own profile');

  // 6. User Search & Safe Public Fields
  console.log('\n--- TEST 6: User Search & Safe Public Fields ---');
  const searchRes = await fetch(`${baseUrl}/api/users/search?q=Mikasa`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  assert(searchRes.status === 200, 'User search returns 200');
  const searchList = await searchRes.json();
  assert(searchList.length > 0, 'Found user in search results');
  const foundUser = searchList.find(u => u.id === registeredUserId);
  assert(foundUser !== undefined, 'Search result matches registered user');
  assert(foundUser.username === testUser.username, 'Includes public username');
  assert(foundUser.name.includes('Survey Corps Leader'), 'Includes public name');
  assert(foundUser.avatar !== undefined, 'Includes avatar');
  assert(foundUser.status !== undefined, 'Includes online status');
  assert(foundUser.connection_status !== undefined, 'Includes connection status relative to requester');
  assert(!foundUser.password, 'Search results STRICTLY omit password field');
  assert(foundUser.email === undefined, 'Search results STRICTLY omit private email address');

  // Search by username
  const searchUsernameRes = await fetch(`${baseUrl}/api/users/search?q=${testUser.username}`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  const searchUsernameList = await searchUsernameRes.json();
  assert(searchUsernameList.some(u => u.id === registeredUserId), 'Search by @username succeeds');

  // Search by email where appropriate (finds the user, but still does not expose email)
  const searchEmailRes = await fetch(`${baseUrl}/api/users/search?q=${testUser.email}`, {
    headers: { 'Authorization': `Bearer ${user1Token}` }
  });
  const searchEmailList = await searchEmailRes.json();
  assert(searchEmailList.some(u => u.id === registeredUserId), 'Search by email succeeds in finding user');
  const userFoundByEmail = searchEmailList.find(u => u.id === registeredUserId);
  assert(userFoundByEmail.email === undefined, 'Search result found via email safely omits email field from response');

  // 7. Logout & Session Invalidation
  console.log('\n--- TEST 7: Logout & Session Destruction ---');
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200 OK');

  // Verify status in DB is updated to offline
  const offlineCheck = await UserService.getUserById(registeredUserId, true);
  assert(offlineCheck.status === 'offline', 'Logout updates user status to offline in database');
  assert(offlineCheck.last_seen !== null, 'Logout records last_seen timestamp in database');

  // Discarded / invalid token access check
  const invalidTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': 'Bearer expired.or.deleted.token' }
  });
  assert(invalidTokenRes.status === 403, 'Discarded/invalid session token cannot access protected endpoints');

  console.log('\n======================================================');
  console.log(`AUTH & USER SYSTEM RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  server.close();
  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runAuthUserTests().catch(err => {
  console.error('Test error:', err);
  if (server) server.close();
  process.exit(1);
});
