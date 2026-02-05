/**
 * Database Cleanup Script - Remove duplicate archived bookings
 * Run this once to clean up any existing duplicates
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Booking = require('./models/Booking');
const BookingArchive = require('./models/BookingArchive');

async function cleanupDuplicates() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all archived bookings from Booking collection
        console.log('🔍 Scanning for duplicates...');
        
        const bookingArchive = await Booking.find({
            $or: [
                { archived: true },
                { status: { $in: ['Cancelled', 'Expired', 'No-Show', 'Arrived'] } }
            ]
        }).lean();

        const archiveRaw = await BookingArchive.find({}).lean();

        // Build a set of referenceNumbers from BookingArchive
        const archiveRefs = new Set();
        archiveRaw.forEach(doc => {
            if (doc.referenceNumber) {
                archiveRefs.add(doc.referenceNumber);
            }
        });

        console.log(`📦 Found ${bookingArchive.length} archived bookings in Booking collection`);
        console.log(`📦 Found ${archiveRaw.length} bookings in BookingArchive`);
        console.log(`📦 ${archiveRefs.size} unique referenceNumbers in BookingArchive\n`);

        // Find bookings in Booking collection that also exist in BookingArchive
        const duplicates = [];
        for (const booking of bookingArchive) {
            if (booking.referenceNumber && archiveRefs.has(booking.referenceNumber)) {
                duplicates.push({
                    referenceNumber: booking.referenceNumber,
                    id: booking.id,
                    _id: booking._id
                });
            }
        }

        console.log(`🔴 Found ${duplicates.length} duplicate bookings to remove from Booking collection:\n`);
        duplicates.forEach(dup => {
            console.log(`   - ${dup.referenceNumber} (id: ${dup.id}, _id: ${dup._id})`);
        });

        if (duplicates.length === 0) {
            console.log('\n✅ No duplicates found. Database is clean!');
        } else {
            console.log('\n⚠️  To remove duplicates, update the archive endpoint to ensure proper deletion.');
            console.log('   The archive route should delete from Booking collection after creating archive entry.');
        }

        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

cleanupDuplicates();
