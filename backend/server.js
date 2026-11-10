const config = require('./config/env'); // validates env first; exits on bad config
const mongoose = require('mongoose');
const app = require('./app');
const { expirePendingBookings } = require('./services/bookingService');

const EXPIRY_INTERVAL_MS = 10 * 60 * 1000;

async function runExpiryJob() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    const n = await expirePendingBookings();
    if (n > 0) console.log(`[expiry] ${n} pending booking(s) expired`);
  } catch (err) {
    console.error('[expiry] failed:', err);
  }
}

async function start() {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      dbName: config.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    // Host only — never log the connection string (it contains credentials)
    console.log(`✅ Connected to MongoDB (${mongoose.connection.host}/${mongoose.connection.name})`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }

  // Data written by an older version (separate archive collection) is migrated
  // automatically, with a JSON backup in backend/backups/ first.
  const legacy = await mongoose.connection.db
    .listCollections({ name: 'bookingarchives' }).toArray();
  if (legacy.length && (await mongoose.connection.db.collection('bookingarchives').countDocuments()) > 0) {
    console.log('ℹ️  Old-format archive records found — migrating them now.');
    const { runMigration } = require('./scripts/migrate-to-unified-bookings');
    const { conflicts } = await runMigration(mongoose, { apply: true });
    if (conflicts.length) {
      console.error(`❌ ${conflicts.length} archive record(s) conflict with existing bookings: ${conflicts.join(', ')}`);
      console.error('   They were left in "bookingarchives". Resolve them, then restart.');
      process.exit(1);
    }
  }

  await runExpiryJob();
  setInterval(runExpiryJob, EXPIRY_INTERVAL_MS).unref();

  const server = app.listen(config.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${config.PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => mongoose.connection.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) start();

module.exports = { start };
