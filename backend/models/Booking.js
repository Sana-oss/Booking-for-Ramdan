const mongoose = require('mongoose');
const {
  generateReferenceNumber,
  pendingExpiryFrom,
  MAX_PARTY_SIZE,
  NOTES_MAX_LENGTH,
  STATUSES,
} = require('../utils/booking-rules');

/**
 * One document per reservation for its whole life.
 *
 *   Pending ──► Confirmed ──► Arrived | No-Show
 *      │            │
 *      └──► Cancelled / Expired ◄──┘        (any closed status can be restored)
 *
 * "Archived" is not a separate collection any more: it is simply a booking in
 * a closed status. Every transition is recorded in statusHistory.
 */
const statusChangeSchema = new mongoose.Schema({
  status: { type: String, enum: STATUSES, required: true },
  at: { type: Date, required: true },
  by: { type: String, required: true },       // username or 'System' / 'Guest'
  reason: { type: String, maxlength: 500 },
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  // Legacy numeric identifier (still used in success-page URLs)
  id: { type: Number, required: true, unique: true },
  // Public reference shown to guests: CRT-XXXXXX (legacy: CRT-XXXX)
  referenceNumber: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  date: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
  },
  time: { type: String, default: '19:00' },
  guests: { type: Number, required: true, min: 1, max: MAX_PARTY_SIZE },
  numberOfSeats: { type: Number, required: true, min: 1, max: MAX_PARTY_SIZE },
  isGroup: { type: Boolean, default: false },
  notes: { type: String, default: '', maxlength: NOTES_MAX_LENGTH },

  status: { type: String, enum: STATUSES, default: 'Pending', required: true },
  statusHistory: { type: [statusChangeSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }, // only set while Pending

  // When/why/by whom the booking was closed (Cancelled, Expired, Arrived,
  // No-Show). Cleared if it is restored. Read by the Archives page.
  archivedAt: { type: Date, default: null },
  archiveReason: { type: String, default: null },
  archivedBy: { type: String, default: null },
}, {
  timestamps: true,
  collection: 'bookings',
});

bookingSchema.pre('validate', async function assignReference(next) {
  try {
    if (this.isNew && !this.referenceNumber) {
      for (let attempt = 0; attempt < 5 && !this.referenceNumber; attempt++) {
        const candidate = generateReferenceNumber();
        // eslint-disable-next-line no-await-in-loop
        if (!(await this.constructor.exists({ referenceNumber: candidate }))) {
          this.referenceNumber = candidate;
        }
      }
      if (!this.referenceNumber) throw new Error('Could not allocate a unique reference number');
    }
    if (this.isNew && this.status === 'Pending' && !this.expiresAt) {
      this.expiresAt = pendingExpiryFrom(this.createdAt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

bookingSchema.index({ date: 1, status: 1 });        // capacity checks
bookingSchema.index({ status: 1, createdAt: 1 });   // auto-expiry job
bookingSchema.index({ phone: 1, date: 1 });         // duplicate check
bookingSchema.index({ status: 1, archivedAt: -1 }); // archives page

module.exports = mongoose.model('Booking', bookingSchema);
