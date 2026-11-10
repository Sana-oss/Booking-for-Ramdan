/**
 * Environment configuration, validated once at startup.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PLACEHOLDER = /your|change|secret-key|example|dev-secret/i;
const SECRET_FILE = path.join(__dirname, '..', '.jwt-secret');

function fail(message) {
  console.error(`\n❌ Configuration error: ${message}\n   See backend/.env.example\n`);
  process.exit(1);
}

const isStrongSecret = (s) => typeof s === 'string' && s.length >= 32 && !PLACEHOLDER.test(s);

/**
 * JWT signing secret. Uses JWT_SECRET when it is a real secret. Otherwise
 * (missing or a placeholder) a strong random secret is generated once and kept
 * in backend/.jwt-secret (git-ignored), so the server is never run with a
 * guessable key and no manual step is needed.
 */
function resolveJwtSecret() {
  if (isStrongSecret(process.env.JWT_SECRET)) return process.env.JWT_SECRET;

  try {
    const stored = fs.readFileSync(SECRET_FILE, 'utf8').trim();
    if (isStrongSecret(stored)) return stored;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(SECRET_FILE, `${generated}\n`, { mode: 0o600 });
    console.warn('🔑 JWT_SECRET was missing or a placeholder — generated a new one in backend/.jwt-secret');
  } catch (err) {
    console.warn(`⚠️  Could not save ${SECRET_FILE} (${err.message}); sign-ins will reset on restart`);
  }
  return generated;
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) fail('MONGODB_URI is not set.');

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'CorinthiaDB',
  JWT_SECRET: resolveJwtSecret(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  // Comma-separated list of extra origins allowed to call the API cross-origin.
  // Leave empty when the frontend is served by this same server (the default).
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
};
