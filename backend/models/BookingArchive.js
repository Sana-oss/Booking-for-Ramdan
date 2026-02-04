/**
 * BookingArchive Model - Opera PMS Style Archiving
 * Stores completed/cancelled/expired bookings for historical records
 */

const mongoose = require('mongoose');

const bookingArchiveSchema = new mongoose.Schema({
  // Original booking fields (mirrored from Booking)
  id: {
    type: Number,
    required: true,
    index: true
  },
  referenceNumber: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20
  },
  date: {
    type: String,
    required: true
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  numberOfSeats: {
    type: Number,
    default: 1
  },
  isGroup: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled', 'Arrived', 'No-Show', 'Expired'],
    default: 'Cancelled'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  
  // Archive-specific fields
  archiveReason: {
    type: String,
    enum: ['Arrived', 'No-Show', 'Cancelled', 'Expired', 'Manual'],
    required: true,
    index: true
  },
  archivedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  originalReference: {
    type: String,
    description: 'The original CRT-XXXX reference number at time of archiving'
  },
  archivedBy: {
    type: String,
    description: 'Admin username who performed the archive action',
    default: 'System'
  },
  notes: {
    type: String,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'bookingarchives',
  dbName: 'corinthiaDB'
});

// Indexes for efficient querying
bookingArchiveSchema.index({ referenceNumber: 1, archivedAt: -1 });
bookingArchiveSchema.index({ archiveReason: 1, archivedAt: -1 });
bookingArchiveSchema.index({ date: 1, archiveReason: 1 });

// Virtual for calculating total seats served
bookingArchiveSchema.virtual('seatsServed').get(function() {
  if (this.archiveReason === 'Arrived') {
    return this.numberOfSeats || this.guests;
  }
  return 0;
});

// Static method to get archive statistics
bookingArchiveSchema.statics.getStats = async function(startDate, endDate) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.archivedAt = {};
    if (startDate) matchStage.archivedAt.$gte = new Date(startDate);
    if (endDate) matchStage.archivedAt.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$archiveReason',
        count: { $sum: 1 },
        totalGuests: { $sum: '$guests' },
        totalSeats: { $sum: '$numberOfSeats' }
      }
    }
  ]);
  
  return stats;
};

// Ensure model uses corinthiaDB connection
const BookingArchive = mongoose.model('BookingArchive', bookingArchiveSchema, 'bookingarchives', 'corinthiaDB');

module.exports = BookingArchive;
