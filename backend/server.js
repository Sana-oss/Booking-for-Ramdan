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

  // Refuse to run against un-migrated data (old separate archive collection)
  const legacy = await mongoose.connection.db
    .listCollections({ name: 'bookingarchives' }).toArray();
  if (legacy.length) {
    const count = await mongoose.connection.db.collection('bookingarchives').countDocuments();
    if (count > 0) {
      console.error(`❌ Found ${count} record(s) in the old "bookingarchives" collection.`);
      console.error('   Run the migration first:  npm run migrate        (dry run)');
      console.error('                             npm run migrate -- --apply');
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
