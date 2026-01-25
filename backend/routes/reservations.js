const express = require('express');
const { body, param, validationResult } = require('express-validator');
const Reservation = require('../models/Reservation');
const { auth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Generate unique reservation ID
function generateReservationId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// @route   POST /api/reservations
// @desc    Create a new reservation
// @access  Public
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone').trim().notEmpty().withMessage('Phone is required').matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone format').isLength({ min: 7, max: 20 }).withMessage('Phone must be 7-20 characters'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body('people').isInt({ min: 1, max: 1000 }).withMessage('People must be between 1 and 1000'),
  body('group').optional().isBoolean().withMessage('Group must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, phone, date, people, group = false } = req.body;

    // Check for duplicate reservation
    const existingReservation = await Reservation.findOne({
      phone: phone.replace(/\D/g, ''), // Normalize phone
      date: date,
      status: { $not: /ملغي/ } // Not cancelled
    });

    if (existingReservation) {
      return res.status(409).json({
        message: 'Duplicate reservation found',
        error: 'A reservation already exists for this phone number on the selected date'
      });
    }

    // Create new reservation
    const reservation = new Reservation({
      id: generateReservationId(),
      name: name.trim(),
      phone: phone.replace(/\D/g, ''), // Store normalized phone
      date,
      people: parseInt(people),
      group,
      status: 'قيد الانتظار'
    });

    await reservation.save();

    res.status(201).json({
      message: 'Reservation created successfully',
      reservation: {
        id: reservation.id,
        name: reservation.name,
        phone: reservation.phone,
        date: reservation.date,
        people: reservation.people,
        group: reservation.group,
        status: reservation.status
      }
    });
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reservations
// @desc    Get all reservations
// @access  Private (Admin only)
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const { status, date, search } = req.query;

    let query = {};

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Filter by date
    if (date) {
      query.date = date;
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { id: isNaN(search) ? null : parseInt(search) }
      ].filter(Boolean);
    }

    const reservations = await Reservation.find(query)
      .sort({ createdAt: -1 })
      .select('-__v');

    res.json({
      count: reservations.length,
      reservations
    });
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reservations/:id
// @desc    Get reservation by ID
// @access  Private (Admin only)
router.get('/:id', auth, requireAdmin, [
  param('id').isInt().withMessage('Invalid reservation ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const reservation = await Reservation.findOne({ id: parseInt(req.params.id) });

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    res.json({ reservation });
  } catch (error) {
    console.error('Get reservation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/reservations/:id
// @desc    Update reservation status
// @access  Private (Admin only)
router.put('/:id', auth, requireAdmin, [
  param('id').isInt().withMessage('Invalid reservation ID'),
  body('status').isIn(['قيد الانتظار', 'تم التأكيد', 'ملغي']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { status } = req.body;
    const reservationId = parseInt(req.params.id);

    const reservation = await Reservation.findOneAndUpdate(
      { id: reservationId },
      { status },
      { new: true, runValidators: true }
    );

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    res.json({
      message: 'Reservation updated successfully',
      reservation
    });
  } catch (error) {
    console.error('Update reservation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/reservations/:id
// @desc    Delete reservation
// @access  Private (Admin only)
router.delete('/:id', auth, requireAdmin, [
  param('id').isInt().withMessage('Invalid reservation ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const reservation = await Reservation.findOneAndDelete({ id: parseInt(req.params.id) });

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    res.json({
      message: 'Reservation deleted successfully',
      reservation: {
        id: reservation.id,
        name: reservation.name
      }
    });
  } catch (error) {
    console.error('Delete reservation error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/reservations/check/:phone/:date
// @desc    Check for duplicate reservation
// @access  Public
router.get('/check/:phone/:date', [
  param('phone').matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone format'),
  param('date').isISO8601().withMessage('Invalid date format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { phone, date } = req.params;
    const normalizedPhone = phone.replace(/\D/g, '');

    const existingReservation = await Reservation.findOne({
      phone: normalizedPhone,
      date: date,
      status: { $not: /ملغي/ }
    });

    res.json({
      hasDuplicate: !!existingReservation,
      reservation: existingReservation ? {
        id: existingReservation.id,
        status: existingReservation.status
      } : null
    });
  } catch (error) {
    console.error('Check duplicate error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
