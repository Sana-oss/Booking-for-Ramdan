/**
 * Backfill Script: Add archivedAt field to existing BookingArchive documents
 * This fills in the missing archivedAt field using updatedAt or createdAt as fallback
 * 
 * Run: node backfill-archived-at.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/corinthia';

async function backfillArchivedAt() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const BookingArchive = require('./models/BookingArchive');

        // Find all documents missing archivedAt
        const result = await BookingArchive.updateMany(
            { archivedAt: { $exists: false } },
            {
                $set: {
                    archivedAt: new Date()
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} documents`);

        // Also update documents where archivedAt is null
        const result2 = await BookingArchive.updateMany(
            { archivedAt: null },
            {
                $set: {
                    archivedAt: new Date()
                }
            }
        );

        console.log(`✅ Updated ${result2.modifiedCount} null documents`);

        console.log('\n✅ Backfill complete! Refresh the Archives page to see dates.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

backfillArchivedAt();
