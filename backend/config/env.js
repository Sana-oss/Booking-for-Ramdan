/**
 * Environment configuration, validated once at startup.
 * The server refuses to start with missing or placeholder secrets.
 */
require('dotenv').config();

const PLACEHOLDER = /your|change|secret-key|example|dev-secret/i;

function fail(message) {
  console.error(`\n❌ Configuration error: ${message}\n   See backend/.env.example\n`);
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) fail('MONGODB_URI is not set.');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32 || PLACEHOLDER.test(JWT_SECRET)) {
  fail('JWT_SECRET must be a random value of at least 32 characters (not a placeholder).\n'
    + "   Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\"");
}

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGODB_URI,
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'CorinthiaDB',
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  // Comma-separated list of extra origins allowed to call the API cross-origin.
  // Leave empty when the frontend is served by this same server (the default).
  CORS_ORIGINS: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
};
