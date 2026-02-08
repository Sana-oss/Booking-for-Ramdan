/**
 * MongoDB Connection Test Script
 * Run this to test connectivity to MongoDB Atlas
 */

require('dotenv').config();
const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI;

console.log('🧪 Testing MongoDB Atlas Connection...\n');
console.log('📍 Connection string:', mongoURI.substring(0, 50) + '...\n');

mongoose.connect(mongoURI)
    .then(() => {
        console.log('✅ SUCCESS: Connected to MongoDB Atlas!');
        console.log('📊 Database:', mongoose.connection.name);
        console.log('🏠 Host:', mongoose.connection.host);
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ FAILED: Could not connect to MongoDB Atlas');
        console.error('Error message:', err.message);
        console.error('\n🔧 Troubleshooting steps:');
        console.error('1. Check your IP whitelist in MongoDB Atlas');
        console.error('2. Verify cluster is running (not paused)');
        console.error('3. Check internet connectivity');
        process.exit(1);
    });
