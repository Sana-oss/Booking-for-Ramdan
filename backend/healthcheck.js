// Health check script for Docker
const mongoose = require('mongoose');

async function healthCheck() {
  try {
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected');
      process.exit(1);
    }

    // Check if we can query the database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Health check passed');
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

healthCheck();
