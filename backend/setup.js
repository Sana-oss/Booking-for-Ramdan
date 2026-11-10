/**
 * One-time bootstrap: create the first superadmin account.
 *
 *   SETUP_ADMIN_USERNAME=... SETUP_ADMIN_PASSWORD=... SETUP_ADMIN_NAME=... npm run setup
 *
 * Refuses to run if a superadmin already exists. The password is never printed.
 */
const config = require('./config/env');
const mongoose = require('mongoose');
const Admin = require('./models/Admin');

async function setupAdmin() {
  const username = (process.env.SETUP_ADMIN_USERNAME || '').trim().toLowerCase();
  const password = process.env.SETUP_ADMIN_PASSWORD || '';
  const name = (process.env.SETUP_ADMIN_NAME || 'Administrator').trim();

  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw new Error('Set SETUP_ADMIN_USERNAME (3-50 letters, digits, . _ -)');
  }
  if (password.length < 12) {
    throw new Error('Set SETUP_ADMIN_PASSWORD (at least 12 characters)');
  }

  await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DB_NAME });
  try {
    if (await Admin.exists({ role: 'superadmin' })) {
      console.log('A superadmin already exists — nothing to do.');
      return;
    }
    // Plain password: the Admin model hashes it in its pre-save hook
    await Admin.create({ username, password, name, role: 'superadmin', isActive: true });
    console.log(`✅ Superadmin "${username}" created.`);
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  setupAdmin().catch((err) => {
    console.error(`❌ Setup failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = setupAdmin;
