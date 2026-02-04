/**
 * CORINTHIA HOTEL - FORCE ADMIN RESET
 * Run: node reset-admin-simple.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function forceReset() {
  // Connect directly without models to avoid caching issues
  await mongoose.connect('mongodb://localhost:27017/corinthiaDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const db = mongoose.connection.db;
  const adminsCollection = db.collection('admins');

  console.log('🔗 Connected to MongoDB');

  // Force delete existing admin
  await adminsCollection.deleteOne({ username: 'admin' });
  console.log('🗑️  Removed existing admin (if any)');

  // Create fresh admin with explicitly hashed password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);

  await adminsCollection.insertOne({
    username: 'admin',
    password: hashedPassword,
    name: 'Administrator',
    role: 'superadmin',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log('✅ Admin created with explicit password hash');
  console.log(`👤 Username: admin`);
  console.log(`🔑 Password: admin123`);
  console.log(`⭐ Role: superadmin`);

  // Verify by reading back
  const admin = await adminsCollection.findOne({ username: 'admin' });
  console.log('\n📋 Stored Admin Record:');
  console.log(`   - username: ${admin.username}`);
  console.log(`   - role: ${admin.role}`);
  console.log(`   - isActive: ${admin.isActive}`);
  console.log(`   - password length: ${admin.password.length} chars`);

  // Test password locally
  const isMatch = await bcrypt.compare('admin123', admin.password);
  console.log(`   - password valid: ${isMatch ? '✅' : '❌'}`);

  await mongoose.connection.close();
  console.log('\n🔒 Connection closed');
}

forceReset().catch(console.error);
