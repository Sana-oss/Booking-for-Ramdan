const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
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
  people: {
    type: Number,
    required: true,
    min: 1,
    max: 1000
  },
  group: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['قيد الانتظار', 'تم التأكيد', 'ملغي'],
    default: 'قيد الانتظار'
  }
}, {
  timestamps: true
});

// Index for efficient queries
reservationSchema.index({ date: 1, phone: 1 });
reservationSchema.index({ id: 1 });
reservationSchema.index({ status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
