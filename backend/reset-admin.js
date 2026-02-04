/**
 * CORINTHIA HOTEL - ADMIN RESET SCRIPT
 * Ensures the admin user has proper role and full access
 * Run: node reset-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('./models/Admin');
require('dotenv').config();

const resetAdmin = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/corinthiaDB', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: 'corinthiaDB'
    });

    console.log('🔗 Connected to MongoDB (corinthiaDB)');

    // Check if admin exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });

    if (existingAdmin) {
      console.log('📝 Admin user found, updating role...');
      
      // Update to ensure admin role and password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      existingAdmin.role = 'superadmin';
      existingAdmin.isActive = true;
      existingAdmin.password = hashedPassword;
      existingAdmin.name = 'Administrator';
      
      await existingAdmin.save();
      
      console.log('✅ Admin user updated successfully!');
      console.log(`👤 Username: admin`);
      console.log(`🔑 Password: admin123`);
      console.log(`⭐ Role: superadmin (full access)`);
    } else {
      console.log('📝 Creating new admin user...');
      
      // Create new admin
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      const admin = new Admin({
        username: 'admin',
        password: hashedPassword,
        name: 'Administrator',
        role: 'superadmin',
        isActive: true
      });

      await admin.save();
      
      console.log('✅ Admin user created successfully!');
      console.log(`👤 Username: admin`);
      console.log(`🔑 Password: admin123`);
      console.log(`⭐ Role: superadmin (full access)`);
    }

    // Verify the admin can access everything
    const admin = await Admin.findOne({ username: 'admin' });
    console.log('\n📋 Admin Permissions:');
    console.log(`   - Can manage users: ${['admin', 'superadmin'].includes(admin.role) ? '✅' : '❌'}`);
    console.log(`   - Can confirm bookings: ${['admin', 'superadmin'].includes(admin.role) ? '✅' : '❌'}`);
    console.log(`   - Can access analytics: ${['superadmin'].includes(admin.role) ? '✅' : '❌'}`);
    console.log(`   - Account active: ${admin.isActive ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ Reset failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔒 Database connection closed');
  }
};

// Run if called directly
if (require.main === module) {
  resetAdmin();
}

module.exports = resetAdmin;
