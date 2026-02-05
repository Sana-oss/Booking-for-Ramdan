/**
 * Backfill Script: Add archivedBy field to existing BookingArchive documents
 * This fills in the missing archivedBy field for existing archived bookings
 * 
 * Run: node backfill-archived-by.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/corinthia';

async function backfillArchivedBy() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const BookingArchive = require('./models/BookingArchive');

        // Find all documents missing archivedBy
        const result = await BookingArchive.updateMany(
            { archivedBy: { $exists: false } },
            {
                $set: {
                    archivedBy: 'System'
                }
            }
        );

        console.log(`✅ Updated ${result.modifiedCount} BookingArchive documents`);

        // Also update documents where archivedBy is null
        const result2 = await BookingArchive.updateMany(
            { archivedBy: null },
            {
                $set: {
                    archivedBy: 'System'
                }
            }
        );

        console.log(`✅ Updated ${result2.modifiedCount} null documents in BookingArchive`);

        console.log('\n✅ Backfill complete! Refresh the Archives page to see archivedBy values.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

backfillArchivedBy();
