const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
require('dotenv').config();

const setupAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ramadan-booking', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('🍃 Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: process.env.DEFAULT_ADMIN_USERNAME || 'admin' });

    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      process.exit(0);
    }

    // Create default admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', salt);

    const admin = new Admin({
      username: process.env.DEFAULT_ADMIN_USERNAME || 'admin',
      password: hashedPassword,
      name: process.env.DEFAULT_ADMIN_NAME || 'Administrator',
      role: 'superadmin',
      isActive: true
    });

    await admin.save();

    console.log('✅ Default admin user created successfully!');
    console.log(`👤 Username: ${admin.username}`);
    console.log(`🔑 Password: ${process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'}`);
    console.log('⚠️  Please change the default password after first login!');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Run setup if called directly
if (require.main === module) {
  setupAdmin();
}

module.exports = setupAdmin;
