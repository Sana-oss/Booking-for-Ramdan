/**
 * HTTP-level security checks that run without a database: every request here
 * is rejected (or served) before any MongoDB query would be made.
 */
process.env.JWT_SECRET = 'test-'.padEnd(48, 'k');
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/unused';
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

mongoose.set('bufferCommands', false); // fail fast if a test accidentally hits the DB

const app = require('../app');
const { hasOperatorKey } = require('../middleware/security');

let server;
let base;

test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const post = (path, body, headers = {}) => fetch(base + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body),
});

test('operator-key detector', () => {
  assert.ok(hasOperatorKey({ username: { $gt: '' } }));
  assert.ok(hasOperatorKey({ a: [{ 'b.c': 1 }] }));
  assert.ok(!hasOperatorKey({ notes: 'price is $5 or $or' })); // values are fine
});

test('login rejects operator injection', async () => {
  const res = await post('/api/auth/login', { username: { $gt: '' }, password: 'x' });
  assert.equal(res.status, 400);
});

test('booking creation validates input before touching the DB', async () => {
  const res = await post('/api/bookings', {
    name: '<img src=x onerror=alert(1)>', phone: '0912345678', date: '2099-01-01', guests: 2,
  });
  assert.equal(res.status, 400);
  const bad = await post('/api/bookings', { name: 'Ali', phone: '1', date: '2099-02-31' });
  assert.equal(bad.status, 400);
});

test('booking creation rejects past dates', async () => {
  const res = await post('/api/bookings', { name: 'Ali Ahmed', phone: '0912345678', date: '2000-01-01', guests: 2 });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /past/i);
});

test('admin endpoints require a token', async () => {
  for (const path of ['/api/bookings', '/api/admin/users', '/api/admin/analytics', '/api/admin/archived-bookings']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(base + path);
    assert.equal(res.status, 401, path);
  }
});

test('forged tokens are rejected', async () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ id: '0'.repeat(24), role: 'superadmin' }, 'dev-secret-do-not-use-in-production-change-this');
  const res = await fetch(`${base}/api/admin/users`, { headers: { Authorization: `Bearer ${forged}` } });
  assert.equal(res.status, 401);
});

test('public lookup rejects malformed identifiers', async () => {
  const res = await fetch(`${base}/api/bookings/not-an-id`);
  assert.equal(res.status, 404);
  const avail = await fetch(`${base}/api/bookings/availability/tomorrow`);
  assert.equal(avail.status, 400);
});

test('removed phone-lookup endpoint no longer exists', async () => {
  const res = await fetch(`${base}/api/bookings/check/0912345678/2099-01-01`);
  assert.equal(res.status, 404);
});

test('security headers and CSP are set', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  const csp = res.headers.get('content-security-policy');
  assert.ok(csp && csp.includes("connect-src 'self'") && csp.includes("frame-ancestors 'none'") && /script-src 'self'(;|$)/.test(csp) && csp.includes("script-src-attr 'none'"));
  assert.equal(res.headers.get('x-powered-by'), null);
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('docs and config files in the frontend folder are not served', async () => {
  for (const path of ['/README.md', '/ADMIN_SETUP.md', '/Font/AdobeFnt25.lst']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await fetch(base + path);
    assert.equal(res.status, 404, path);
  }
});

test('unknown API routes return JSON 404, invalid JSON returns 400', async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  assert.equal((await post('/api/bookings', '{bad json')).status, 400);
});
