const mongoose = require('mongoose');
const Admin = require('./models/Admin'); // تأكد من المسار الصحيح لموديل الأدمن
require('dotenv').config();

async function reset() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/corinthiaDB');
    console.log("Connected to DB...");
    
    // مسح أي مسؤول قديم
    await Admin.deleteMany({});
    console.log("Old admins cleared.");

    // إنشاء المسؤول الجديد ببيانات صريحة
    const admin = new Admin({
      username: 'admin',
      password: 'admin123', // سيقوم الموديل بتشفيرها تلقائياً عند الحفظ
      name: 'Administrator'
    });

    await admin.save();
    console.log("✅ New Admin created successfully!");
    console.log("Username: admin | Password: admin123");
    
    process.exit();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

reset();