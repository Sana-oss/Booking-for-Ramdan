const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // هنا يقرأ الرابط من ملف الـ .env
        const mongoURI = process.env.MONGODB_URI;

        const conn = await mongoose.connect(mongoURI);

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;