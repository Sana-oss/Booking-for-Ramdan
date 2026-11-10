/**
 * Request-level security middleware.
 *
 * Replaces the former security-validation.js, whose output "XSS escaping" did
 * not escape < > & " and corrupted Date values, and whose NoSQL blocklist
 * missed operators such as $gt/$in while rejecting harmless text.
 */
const rateLimit = require('express-rate-limit');

/**
 * Reject any request whose body, query or params contain object keys that
 * start with "$" or contain "." — the building blocks of MongoDB operator
 * injection. Values are not scanned, so ordinary text is never rejected.
 */
function hasOperatorKey(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((v) => hasOperatorKey(v, depth + 1));
  return Object.keys(value).some(
    (key) => key.startsWith('$') || key.includes('.') || hasOperatorKey(value[key], depth + 1)
  );
}

function rejectOperatorKeys(req, res, next) {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query) || hasOperatorKey(req.params)) {
    return res.status(400).json({ success: false, message: 'Invalid input' });
  }
  next();
}

/**
 * Client IP for rate limiting. The app is published through Cloudflare Tunnel,
 * so every request reaches Express from the local tunnel connector; the real
 * visitor IP is in CF-Connecting-IP.
 */
function clientKey(req) {
  return req.headers['cf-connecting-ip'] || req.ip;
}

const limiter = (options) => rateLimit({
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: { success: false, message: 'Too many requests, please try again later.' },
  ...options,
});

module.exports = {
  hasOperatorKey,
  rejectOperatorKeys,
  // 10 login attempts per 15 minutes per IP
  loginLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true }),
  // 10 new bookings per hour per IP
  createBookingLimiter: limiter({ windowMs: 60 * 60 * 1000, max: 10 }),
  // Public lookups (status page polls every ~10s): 120 per 15 minutes per IP
  publicLookupLimiter: limiter({ windowMs: 15 * 60 * 1000, max: 120 }),
};
