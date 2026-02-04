const mongoose = require('mongoose');

/**
 * Generate a professional booking reference number
 * Format: CRT-XXXX (4 uppercase letters/numbers mixed)
 */
function generateReferenceNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar chars like I, O, 0, 1
  let result = 'CRT-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const bookingSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  referenceNumber: {
    type: String,
    unique: true,
    sparse: true, // Allows null for existing documents without this field
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
    required: true,
    validate: {
      validator: function(v) {
        // Validate date format YYYY-MM-DD
        return /^\d{4}-\d{2}-\d{2}$/.test(v);
      },
      message: 'Date must be in YYYY-MM-DD format'
    }
  },
  time: {
    type: String,
    default: '19:00',
    description: 'Reservation time in HH:mm format'
  },
  guests: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  numberOfSeats: {
    type: Number,
    default: 1,
    min: 1,
    max: 200,
    description: 'Number of seats reserved (same as guests for most bookings)'
  },
  isGroup: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Pending', 'Confirmed', 'Cancelled'],
    default: 'Pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    description: 'Auto-cancellation time (createdAt + 24 hours for Pending bookings)'
  }
}, { 
  timestamps: true,
  collection: 'bookings',
  dbName: 'corinthiaDB'  // Explicitly bind to corinthiaDB
});

// Pre-save hook to generate referenceNumber and calculate expiresAt
bookingSchema.pre('save', async function(next) {
  // Generate referenceNumber for new bookings if not exists
  if (this.isNew && !this.referenceNumber) {
    let unique = false;
    let newRef = '';
    const Booking = mongoose.model('Booking');
    
    // Try up to 10 times to generate a unique reference
    for (let attempt = 0; attempt < 10 && !unique; attempt++) {
      newRef = generateReferenceNumber();
      const existing = await Booking.findOne({ referenceNumber: newRef });
      if (!existing) {
        unique = true;
      }
    }
    
    if (unique) {
      this.referenceNumber = newRef;
    } else {
      // Fallback: use timestamp-based reference
      this.referenceNumber = 'CRT-' + Date.now().toString(36).toUpperCase();
    }
  }
  
  // Set expiresAt for Pending bookings
  if (this.isNew || this.isModified('status')) {
    if (this.status === 'Pending') {
      this.expiresAt = new Date(this.createdAt.getTime() + 24 * 60 * 60 * 1000);
    } else {
      this.expiresAt = null;
    }
  }
  
  next();
});

// Static method to find by reference number
bookingSchema.statics.findByReference = function(refNumber) {
  // First try to find by referenceNumber
  return this.findOne({ referenceNumber: refNumber });
};

// Create text index for search functionality
bookingSchema.index({ name: 'text', phone: 'text', referenceNumber: 'text' });

// Ensure model uses corinthiaDB connection
const Booking = mongoose.model('Booking', bookingSchema, 'bookings', 'corinthiaDB');

module.exports = Booking;