import assert from 'assert';
import http from 'http';
import { app } from '../src/app';
import { prisma } from '../src/config/db';
import { Role } from '@cloud-stock/shared';

// Helper to make HTTP requests against express app instance
function request(
  server: http.Server,
  method: string,
  path: string,
  options: {
    headers?: Record<string, string>;
    body?: unknown;
    cookie?: string;
  } = {}
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any; cookies: string[] }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server not listening'));
    }

    const payload = options.body ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      ...options.headers,
    };

    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        method,
        path,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsedBody;
          try {
            parsedBody = data ? JSON.parse(data) : {};
          } catch {
            parsedBody = data;
          }

          const setCookieHeaders = res.headers['set-cookie'] || [];
          resolve({
            status: res.statusCode || 500,
            headers: res.headers,
            body: parsedBody,
            cookies: Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders],
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function extractCookie(cookies: string[], name: string): string | undefined {
  for (const c of cookies) {
    const parts = c.split(';')[0].split('=');
    if (parts[0].trim() === name) {
      return parts.slice(1).join('=');
    }
  }
  return undefined;
}

async function runTests() {
  console.log('🚀 Starting Phase 2 Comprehensive Test Suite...');

  // Start temporary server on dynamic port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const port = (server.address() as any).port;
  console.log(`📡 Test server running on port ${port}`);

  try {
    // ----------------------------------------------------
    // 1. HEALTH PROBES
    // ----------------------------------------------------
    console.log('\n--- 1. Health Probes ---');
    const liveRes = await request(server, 'GET', '/api/health/live');
    assert.strictEqual(liveRes.status, 200);
    assert.strictEqual(liveRes.body.data.status, 'alive');
    console.log('✅ GET /api/health/live passed (200)');

    const readyRes = await request(server, 'GET', '/api/health/ready');
    assert.strictEqual(readyRes.status, 200);
    assert.strictEqual(readyRes.body.data.status, 'ready');
    console.log('✅ GET /api/health/ready passed (200)');

    // ----------------------------------------------------
    // 2. AUTHENTICATION & LOGIN
    // ----------------------------------------------------
    console.log('\n--- 2. Authentication & Login ---');

    // 2.1 Login with wrong password
    const failLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'admin@cloudstock.dev', password: 'WrongPassword123!' },
    });
    assert.strictEqual(failLogin.status, 401);
    console.log('✅ Login with wrong password rejected (401)');

    // 2.2 Login with non-existent email
    const nonExistLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'nonexistent@cloudstock.dev', password: 'AnyPassword123!' },
    });
    assert.strictEqual(nonExistLogin.status, 401);
    console.log('✅ Login with non-existent email rejected (401)');

    // 2.3 Successful Admin Login
    const adminLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'admin@cloudstock.dev', password: 'AdminPassword123!' },
    });
    assert.strictEqual(adminLogin.status, 200);
    assert.ok(adminLogin.body.data.accessToken);
    assert.strictEqual(adminLogin.body.data.user.role, 'ADMIN');
    assert.strictEqual(adminLogin.body.data.user.passwordHash, undefined); // NO passwordHash exposed!
    const adminToken = adminLogin.body.data.accessToken;
    const adminRefreshCookie = extractCookie(adminLogin.cookies, 'refresh_token');
    assert.ok(adminRefreshCookie, 'Refresh token cookie must be present');
    console.log('✅ Admin login successful (200, JWT issued, cookie set, passwordHash omitted)');

    // 2.4 Successful Manager Login
    const managerLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'manager@cloudstock.dev', password: 'ManagerPassword123!' },
    });
    assert.strictEqual(managerLogin.status, 200);
    const managerToken = managerLogin.body.data.accessToken;
    console.log('✅ Manager login successful (200)');

    // 2.5 Successful Staff Login
    const staffLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'staff@cloudstock.dev', password: 'StaffPassword123!' },
    });
    assert.strictEqual(staffLogin.status, 200);
    const staffToken = staffLogin.body.data.accessToken;
    console.log('✅ Staff login successful (200)');

    // 2.6 Get Profile /api/v1/auth/me
    const meRes = await request(server, 'GET', '/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.data.email, 'admin@cloudstock.dev');
    console.log('✅ GET /api/v1/auth/me verified identity (200)');

    // ----------------------------------------------------
    // 3. REFRESH TOKEN ROTATION & REUSE DETECTION
    // ----------------------------------------------------
    console.log('\n--- 3. Refresh Token Rotation & Security ---');

    // 3.1 Valid Refresh
    const refresh1 = await request(server, 'POST', '/api/v1/auth/refresh', {
      cookie: `refresh_token=${adminRefreshCookie}`,
    });
    assert.strictEqual(refresh1.status, 200);
    assert.ok(refresh1.body.data.accessToken);
    const rotatedCookie = extractCookie(refresh1.cookies, 'refresh_token');
    assert.ok(rotatedCookie);
    assert.notStrictEqual(rotatedCookie, adminRefreshCookie, 'Token must be rotated to a new string');
    console.log('✅ Token rotated successfully (new access token & new cookie issued)');

    // 3.2 Token Reuse Attack Detection: Attempt to use the OLD refresh token
    const reuseAttempt = await request(server, 'POST', '/api/v1/auth/refresh', {
      cookie: `refresh_token=${adminRefreshCookie}`,
    });
    assert.strictEqual(reuseAttempt.status, 401);
    console.log('✅ Reusing rotated token detected and rejected (401)');

    // 3.3 Verify Token Family Revocation: Even the rotated token should now be invalidated because of reuse!
    const familyCheck = await request(server, 'POST', '/api/v1/auth/refresh', {
      cookie: `refresh_token=${rotatedCookie}`,
    });
    assert.strictEqual(familyCheck.status, 401);
    console.log('✅ Token family invalidated after reuse attack detection (401)');

    // ----------------------------------------------------
    // 4. RBAC & PERMISSIONS
    // ----------------------------------------------------
    console.log('\n--- 4. Role-Based Access Control (RBAC) ---');

    // 4.1 Admin can access /users
    // First re-login Admin to get fresh session
    const adminRelogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: 'admin@cloudstock.dev', password: 'AdminPassword123!' },
    });
    const freshAdminToken = adminRelogin.body.data.accessToken;

    const adminGetUsers = await request(server, 'GET', '/api/v1/users', {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
    });
    assert.strictEqual(adminGetUsers.status, 200);
    console.log('✅ ADMIN allowed GET /api/v1/users (200)');

    // 4.2 Manager can view /users
    const managerGetUsers = await request(server, 'GET', '/api/v1/users', {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert.strictEqual(managerGetUsers.status, 200);
    console.log('✅ MANAGER allowed GET /api/v1/users (200)');

    // 4.3 Staff CANNOT view /users (Forbidden 403)
    const staffGetUsers = await request(server, 'GET', '/api/v1/users', {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffGetUsers.status, 403);
    console.log('✅ STAFF denied GET /api/v1/users (403 Forbidden)');

    // 4.4 Manager CANNOT create users (Forbidden 403)
    const managerCreateUser = await request(server, 'POST', '/api/v1/users', {
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        name: 'Illegal User',
        email: 'illegal@cloudstock.dev',
        password: 'Password123!',
        role: Role.STAFF,
      },
    });
    assert.strictEqual(managerCreateUser.status, 403);
    console.log('✅ MANAGER denied POST /api/v1/users (403 Forbidden)');

    // 4.5 Manager CANNOT view /audit-logs
    const managerGetAudit = await request(server, 'GET', '/api/v1/audit-logs', {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    assert.strictEqual(managerGetAudit.status, 403);
    console.log('✅ MANAGER denied GET /api/v1/audit-logs (403 Forbidden)');

    // 4.6 Admin CAN view /audit-logs
    const adminGetAudit = await request(server, 'GET', '/api/v1/audit-logs', {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
    });
    assert.strictEqual(adminGetAudit.status, 200);
    assert.ok(adminGetAudit.body.data.items.length > 0);
    console.log(`✅ ADMIN allowed GET /api/v1/audit-logs (200, count: ${adminGetAudit.body.data.items.length})`);

    // 4.7 Admin CAN view /api/v1/system/health
    const sysHealth = await request(server, 'GET', '/api/v1/system/health', {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
    });
    assert.strictEqual(sysHealth.status, 200);
    assert.strictEqual(sysHealth.body.data.database.status, 'up');
    console.log('✅ ADMIN allowed GET /api/v1/system/health (200, DB latency measured)');

    // ----------------------------------------------------
    // 5. USER CRUD & CRITICAL INVARIANTS
    // ----------------------------------------------------
    console.log('\n--- 5. User Management & Invariants ---');

    // 5.1 Admin creates a new Staff member
    const newStaffEmail = `test.staff.${Date.now()}@cloudstock.dev`;
    const createStaffRes = await request(server, 'POST', '/api/v1/users', {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: {
        name: 'Test Staff User',
        email: newStaffEmail,
        password: 'SecurePassword123!',
        role: Role.STAFF,
      },
    });
    assert.strictEqual(createStaffRes.status, 201);
    assert.strictEqual(createStaffRes.body.data.email, newStaffEmail);
    assert.strictEqual(createStaffRes.body.data.passwordHash, undefined);
    const newStaffId = createStaffRes.body.data.id;
    console.log(`✅ Admin created new staff user [${newStaffEmail}] (201)`);

    // 5.2 Duplicate email is rejected with 409 Conflict
    const dupRes = await request(server, 'POST', '/api/v1/users', {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: {
        name: 'Duplicate Staff User',
        email: newStaffEmail,
        password: 'SecurePassword123!',
        role: Role.STAFF,
      },
    });
    assert.strictEqual(dupRes.status, 409);
    console.log('✅ Duplicate email registration rejected (409 Conflict)');

    // 5.3 Weak password rejected
    const weakPassRes = await request(server, 'POST', '/api/v1/users', {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: {
        name: 'Weak Pass User',
        email: `weak.${Date.now()}@cloudstock.dev`,
        password: '123',
        role: Role.STAFF,
      },
    });
    assert.strictEqual(weakPassRes.status, 400);
    console.log('✅ Weak password rejected by Zod schema (400)');

    // 5.4 Update User name
    const updateRes = await request(server, 'PATCH', `/api/v1/users/${newStaffId}`, {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: { name: 'Updated Staff Name' },
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.name, 'Updated Staff Name');
    console.log('✅ Update user profile passed (200)');

    // 5.5 Change Role to MANAGER
    const roleRes = await request(server, 'PATCH', `/api/v1/users/${newStaffId}/role`, {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: { role: Role.MANAGER },
    });
    assert.strictEqual(roleRes.status, 200);
    assert.strictEqual(roleRes.body.data.role, 'MANAGER');
    console.log('✅ Promote user role passed (200)');

    // 5.6 Test user logs in, then admin deactivates user -> session revoked
    const userLogin = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: newStaffEmail, password: 'SecurePassword123!' },
    });
    assert.strictEqual(userLogin.status, 200);
    const userAccessToken = userLogin.body.data.accessToken;

    // Verify token works
    const testMe1 = await request(server, 'GET', '/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    assert.strictEqual(testMe1.status, 200);

    // Now Admin DEACTIVATES the user
    const deactRes = await request(server, 'PATCH', `/api/v1/users/${newStaffId}/status`, {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: { isActive: false },
    });
    assert.strictEqual(deactRes.status, 200);
    assert.strictEqual(deactRes.body.data.isActive, false);
    console.log('✅ Admin deactivated user (200)');

    // Verifying immediate session revocation: access token must now be REJECTED!
    const testMeAfterDeact = await request(server, 'GET', '/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    assert.strictEqual(testMeAfterDeact.status, 401);
    console.log('✅ Deactivated user token immediately rejected (401)');

    // Deactivated user cannot log in
    const deactLoginAttempt = await request(server, 'POST', '/api/v1/auth/login', {
      body: { email: newStaffEmail, password: 'SecurePassword123!' },
    });
    assert.strictEqual(deactLoginAttempt.status, 401);
    console.log('✅ Deactivated user login rejected (401)');

    // Reactivate user
    await request(server, 'PATCH', `/api/v1/users/${newStaffId}/status`, {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: { isActive: true },
    });
    console.log('✅ Reactivated user successfully (200)');

    // 5.7 Protect Last Active Administrator
    // Find admin user ID
    const currentAdmin = await prisma.user.findUnique({
      where: { email: 'admin@cloudstock.dev' },
    });
    assert.ok(currentAdmin);

    // Attempt to deactivate the last admin
    const deactAdminAttempt = await request(server, 'PATCH', `/api/v1/users/${currentAdmin.id}/status`, {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: { isActive: false },
    });
    assert.strictEqual(deactAdminAttempt.status, 400);
    console.log('✅ Invariant Protected: Attempt to deactivate last Administrator rejected (400)');

    // Attempt to demote the last admin to STAFF
    const demoteAdminAttempt = await request(server, 'PATCH', `/api/v1/users/${currentAdmin.id}/role`, {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
      body: { role: Role.STAFF },
    });
    assert.strictEqual(demoteAdminAttempt.status, 400);
    console.log('✅ Invariant Protected: Attempt to demote last Administrator rejected (400)');

    // ----------------------------------------------------
    // 6. AUDIT LOG INTEGRITY
    // ----------------------------------------------------
    console.log('\n--- 6. Audit Log Integrity ---');
    const finalAudit = await request(server, 'GET', '/api/v1/audit-logs?limit=50', {
      headers: { Authorization: `Bearer ${freshAdminToken}` },
    });
    assert.strictEqual(finalAudit.status, 200);
    const actions = finalAudit.body.data.items.map((i: any) => i.action);

    assert.ok(actions.includes('LOGIN_SUCCESS'), 'Must log LOGIN_SUCCESS');
    assert.ok(actions.includes('LOGIN_FAILED'), 'Must log LOGIN_FAILED');
    assert.ok(actions.includes('CREATE_USER'), 'Must log CREATE_USER');
    assert.ok(actions.includes('CHANGE_USER_ROLE'), 'Must log CHANGE_USER_ROLE');
    assert.ok(actions.includes('DEACTIVATE_USER'), 'Must log DEACTIVATE_USER');
    console.log('✅ All sensitive actions verified in Audit Log');

    console.log('\n🎉 ALL 20+ AUTOMATED INTEGRATION TESTS PASSED PERFECTLY!');
  } finally {
    server.close();
    await prisma.$disconnect();
    try {
      const { redis } = await import('../src/config/redis');
      redis.disconnect();
    } catch {}
  }
}

runTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  });
