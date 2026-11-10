const mongoose = require('mongoose');
const {
  generateReferenceNumber,
  pendingExpiryFrom,
  MAX_PARTY_SIZE,
  NOTES_MAX_LENGTH,
} = require('../utils/booking-rules');

const bookingSchema = new mongoose.Schema({
  // Legacy numeric identifier (still used by the success page URL)
  id: { type: Number, required: true, unique: true },
  // Public reference shown to guests: CRT-XXXXXX (legacy: CRT-XXXX)
  referenceNumber: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  date: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
  },
  time: { type: String, default: '19:00' },
  guests: { type: Number, required: true, min: 1, max: MAX_PARTY_SIZE },
  numberOfSeats: { type: Number, default: 1, min: 1, max: MAX_PARTY_SIZE },
  isGroup: { type: Boolean, default: false },
  notes: { type: String, default: '', maxlength: NOTES_MAX_LENGTH },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled'],
    default: 'Pending',
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },

  // Cancellation / archive audit fields. These were previously written by the
  // routes but silently discarded because they were not declared here.
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: null },
  cancellationReason: { type: String, default: null },
  autoCancelled: { type: Boolean, default: false },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },
  archiveReason: { type: String, default: null },
  archivedBy: { type: String, default: null },
  restoredFromArchive: { type: Boolean, default: false },
  restoredBy: { type: String, default: null },
  restoredAt: { type: Date, default: null },
}, {
  timestamps: true,
  collection: 'bookings',
});

// Generate a unique reference and keep expiresAt consistent with status
bookingSchema.pre('save', async function preSave(next) {
  try {
    if (this.isNew && !this.referenceNumber) {
      const Booking = this.constructor;
      for (let attempt = 0; attempt < 5 && !this.referenceNumber; attempt++) {
        const candidate = generateReferenceNumber();
        // eslint-disable-next-line no-await-in-loop
        if (!(await Booking.exists({ referenceNumber: candidate }))) {
          this.referenceNumber = candidate;
        }
      }
      if (!this.referenceNumber) {
        throw new Error('Could not allocate a unique reference number');
      }
    }

    if (this.isNew || this.isModified('status')) {
      this.expiresAt = this.status === 'Pending' ? pendingExpiryFrom(this.createdAt) : null;
    }
    next();
  } catch (err) {
    next(err);
  }
});

bookingSchema.index({ date: 1, status: 1 });      // capacity checks
bookingSchema.index({ status: 1, createdAt: 1 }); // auto-expiry job
bookingSchema.index({ phone: 1, date: 1 });       // duplicate check

module.exports = mongoose.model('Booking', bookingSchema);
