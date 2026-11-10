const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const BookingArchive = require('../models/BookingArchive');
const { auth, requireAdmin, requireStaff } = require('../middleware/auth');
const { createBookingLimiter, publicLookupLimiter } = require('../middleware/security');
const rules = require('../utils/booking-rules');

const router = express.Router();

const { MAX_DAILY_CAPACITY, ACTIVE_STATUSES } = rules;
const ARCHIVE_REASONS = ['Arrived', 'No-Show', 'Cancelled', 'Expired', 'Manual'];
const EDITABLE_STATUSES = ['Pending', 'Confirmed', 'Cancelled'];

// Fields a guest may see on the public status / success pages (no phone, no notes)
const PUBLIC_FIELDS = 'id referenceNumber name date time guests numberOfSeats isGroup status createdAt expiresAt';

function generateBookingId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Resolve a booking identifier. Accepts a CRT reference, a numeric legacy id,
 * or (only when allowObjectId) a 24-hex Mongo _id. No parseInt on hex strings.
 */
function buildIdFilter(rawId, { allowObjectId = false } = {}) {
  const id = String(rawId || '').trim();
  if (rules.isReferenceNumber(id)) return { referenceNumber: id.toUpperCase() };
  if (allowObjectId && mongoose.isValidObjectId(id) && /^[a-f0-9]{24}$/i.test(id)) return { _id: id };
  if (/^\d{1,18}$/.test(id)) return { id: Number(id) };
  return null;
}

async function seatsUsedOn(date, session) {
  const agg = await Booking.aggregate([
    { $match: { date, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: null, totalSeats: { $sum: '$numberOfSeats' }, totalBookings: { $sum: 1 } } },
  ]).session(session || null);
  return agg[0] || { totalSeats: 0, totalBookings: 0 };
}

function serverError(res, label, error) {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: 'Server error' });
}

// ---------------------------------------------------------------------------
// POST /api/bookings — create a booking (public)
// ---------------------------------------------------------------------------
router.post('/', createBookingLimiter, [
  body('name').custom(rules.isValidName)
    .withMessage('Name must be 2-100 letters (Arabic or English)'),
  body('phone').custom(rules.isValidPhone).withMessage('Invalid phone number'),
  body('date').custom(rules.isValidDateString).withMessage('Date must be YYYY-MM-DD'),
  body(['people', 'guests', 'numberOfSeats']).optional()
    .isInt({ min: 1, max: rules.MAX_PARTY_SIZE }).withMessage(`Guests must be 1-${rules.MAX_PARTY_SIZE}`),
  body(['group', 'isGroup']).optional().isBoolean(),
  body('notes').optional().isString().isLength({ max: 1000 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    }

    const name = rules.normalizeName(req.body.name);
    const phone = rules.normalizePhone(req.body.phone);
    const { date } = req.body;
    const partySize = parseInt(req.body.numberOfSeats || req.body.people || req.body.guests, 10) || 2;
    const isGroup = Boolean(req.body.group || req.body.isGroup) || partySize > 10;
    const notes = rules.normalizeNotes(req.body.notes);

    if (rules.isPastDate(date)) {
      return res.status(400).json({ success: false, message: 'Cannot book for past dates' });
    }

    const existing = await Booking.exists({ phone, date, status: { $in: ACTIVE_STATUSES } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'You already have a booking for this date',
      });
    }

    const before = await seatsUsedOn(date);
    if (before.totalSeats + partySize > MAX_DAILY_CAPACITY) {
      const seatsRemaining = Math.max(0, MAX_DAILY_CAPACITY - before.totalSeats);
      return res.status(400).json({
        success: false,
        message: `Capacity reached for this date. Only ${seatsRemaining} seats remaining.`,
        seatsRemaining,
        maxCapacity: MAX_DAILY_CAPACITY,
      });
    }

    const booking = new Booking({
      id: generateBookingId(),
      name,
      phone,
      date,
      guests: partySize,
      numberOfSeats: partySize,
      isGroup,
      notes,
      status: 'Pending',
      createdAt: new Date(),
    });
    await booking.save();

    // Concurrency guard: simultaneous requests can all pass the check above.
    // Re-count after inserting; if the day is now over capacity, this booking
    // backs out. Under a race every over-limit request backs out, so the limit
    // is never exceeded (at worst a guest is asked to retry).
    const after = await seatsUsedOn(date);
    if (after.totalSeats > MAX_DAILY_CAPACITY) {
      await Booking.deleteOne({ _id: booking._id });
      return res.status(409).json({
        success: false,
        message: 'Capacity reached for this date. Please choose another date.',
        seatsRemaining: Math.max(0, MAX_DAILY_CAPACITY - (after.totalSeats - partySize)),
        maxCapacity: MAX_DAILY_CAPACITY,
      });
    }

    const seatsRemaining = Math.max(0, MAX_DAILY_CAPACITY - Math.min(after.totalSeats, MAX_DAILY_CAPACITY));
    return res.status(201).json({
      success: true,
      message: 'Booking created successfully!',
      bookingId: booking.id,
      referenceNumber: booking.referenceNumber,
      data: await Booking.findById(booking._id).select(PUBLIC_FIELDS).lean(),
      capacity: { seatsRemaining, currentSeatsUsed: after.totalSeats, maxCapacity: MAX_DAILY_CAPACITY },
    });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Please try again' });
    }
    return serverError(res, 'Booking creation error', error);
  }
});

// ---------------------------------------------------------------------------
// Archive routes (must be registered before /:id)
// ---------------------------------------------------------------------------

// POST /api/bookings/archive/:id — move a booking to the archive (staff)
router.post('/archive/:id', auth, requireStaff, async (req, res) => {
  const { archiveReason } = req.body;
  if (!ARCHIVE_REASONS.includes(archiveReason)) {
    return res.status(400).json({ success: false, message: `Invalid archive reason. Must be one of: ${ARCHIVE_REASONS.join(', ')}` });
  }
  const filter = buildIdFilter(req.params.id, { allowObjectId: true });
  if (!filter) return res.status(400).json({ success: false, message: 'Invalid booking id' });

  const session = await mongoose.startSession();
  try {
    let archiveEntry;
    await session.withTransaction(async () => {
      const booking = await Booking.findOne(filter).session(session);
      if (!booking) return;

      const statusFor = { Arrived: 'Arrived', 'No-Show': 'No-Show', Cancelled: 'Cancelled' };
      [archiveEntry] = await BookingArchive.create([{
        id: booking.id,
        referenceNumber: booking.referenceNumber,
        name: booking.name,
        phone: booking.phone,
        date: booking.date,
        guests: booking.guests,
        numberOfSeats: booking.numberOfSeats || booking.guests,
        isGroup: booking.isGroup,
        status: statusFor[archiveReason] || 'Expired',
        createdAt: booking.createdAt,
        expiresAt: booking.expiresAt,
        archiveReason,
        archivedAt: new Date(),
        originalReference: booking.referenceNumber,
        archivedBy: req.admin.username,
        notes: rules.normalizeNotes(req.body.notes || booking.notes).slice(0, 500),
      }], { session });
      await Booking.deleteOne({ _id: booking._id }).session(session);
    });

    if (!archiveEntry) return res.status(404).json({ success: false, message: 'Booking not found' });
    return res.json({ success: true, message: `Booking archived as '${archiveReason}'`, data: archiveEntry });
  } catch (error) {
    return serverError(res, 'Archive error', error);
  } finally {
    await session.endSession();
  }
});

// GET /api/bookings/archive — archived bookings with filters (admin)
router.get('/archive', auth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const { search, reason, startDate, endDate } = req.query;
    const query = {};

    if (typeof search === 'string' && search.trim()) {
      const rx = new RegExp(rules.escapeRegex(search.trim().slice(0, 50)), 'i');
      query.$or = [{ name: rx }, { phone: rx }, { referenceNumber: rx }];
    }
    if (typeof reason === 'string' && ARCHIVE_REASONS.includes(reason)) query.archiveReason = reason;
    if (startDate || endDate) {
      query.archivedAt = {};
      if (startDate) query.archivedAt.$gte = new Date(String(startDate));
      if (endDate) query.archivedAt.$lte = new Date(String(endDate));
    }

    const [archives, total, stats] = await Promise.all([
      BookingArchive.find(query).sort({ archivedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      BookingArchive.countDocuments(query),
      BookingArchive.aggregate([
        { $match: query },
        { $group: { _id: '$archiveReason', count: { $sum: 1 }, totalGuests: { $sum: '$guests' } } },
      ]),
    ]);

    return res.json({
      success: true,
      data: archives,
      pagination: { page, pages: Math.ceil(total / limit), total },
      stats: stats.reduce((acc, s) => ({ ...acc, [s._id]: { count: s.count, totalGuests: s.totalGuests } }), {}),
    });
  } catch (error) {
    return serverError(res, 'Get archives error', error);
  }
});

// GET /api/bookings/archive/stats — archive summary (admin)
router.get('/archive/stats', auth, requireAdmin, async (req, res) => {
  try {
    const match = {};
    if (req.query.startDate || req.query.endDate) {
      match.archivedAt = {};
      if (req.query.startDate) match.archivedAt.$gte = new Date(String(req.query.startDate));
      if (req.query.endDate) match.archivedAt.$lte = new Date(String(req.query.endDate));
    }
    const stats = await BookingArchive.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$archiveReason',
          count: { $sum: 1 },
          arrived: { $sum: { $cond: [{ $eq: ['$archiveReason', 'Arrived'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$archiveReason', 'No-Show'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$archiveReason', 'Cancelled'] }, 1, 0] } },
          expired: { $sum: { $cond: [{ $eq: ['$archiveReason', 'Expired'] }, 1, 0] } },
          totalGuestsServed: { $sum: { $cond: [{ $eq: ['$archiveReason', 'Arrived'] }, '$guests', 0] } },
        },
      },
    ]);
    const data = {};
    stats.forEach(({ _id, ...rest }) => { data[_id] = rest; });
    return res.json({ success: true, data });
  } catch (error) {
    return serverError(res, 'Archive stats error', error);
  }
});

// POST /api/bookings/restore/:id — restore an archived/cancelled booking (admin)
router.post('/restore/:id', auth, requireAdmin, async (req, res) => {
  const rawId = String(req.params.id || '').trim();
  const isObjectId = /^[a-f0-9]{24}$/i.test(rawId);
  const session = await mongoose.startSession();
  try {
    let restored;
    await session.withTransaction(async () => {
      // 1) An entry in the archive collection → recreate as an active booking
      const archived = isObjectId
        ? await BookingArchive.findById(rawId).session(session)
        : rules.isReferenceNumber(rawId)
          ? await BookingArchive.findOne({ referenceNumber: rawId.toUpperCase() }).session(session)
          : null;

      if (archived) {
        [restored] = await Booking.create([{
          id: generateBookingId(),
          referenceNumber: archived.referenceNumber,
          name: archived.name,
          phone: archived.phone,
          date: archived.date,
          guests: archived.guests || archived.numberOfSeats || 1,
          numberOfSeats: archived.numberOfSeats || archived.guests || 1,
          isGroup: archived.isGroup,
          notes: archived.notes || '',
          status: 'Confirmed',
          createdAt: new Date(),
          restoredFromArchive: true,
          restoredBy: req.admin.username,
          restoredAt: new Date(),
        }], { session });
        await BookingArchive.deleteOne({ _id: archived._id }).session(session);
        return;
      }

      // 2) A cancelled booking still in the bookings collection → reactivate
      const filter = buildIdFilter(rawId, { allowObjectId: true });
      const booking = filter ? await Booking.findOne(filter).session(session) : null;
      if (!booking) return;
      Object.assign(booking, {
        status: 'Confirmed',
        archived: false,
        archivedAt: null,
        archiveReason: null,
        archivedBy: null,
        cancelledAt: null,
        cancelledBy: null,
        cancellationReason: null,
        autoCancelled: false,
        restoredFromArchive: true,
        restoredBy: req.admin.username,
        restoredAt: new Date(),
      });
      restored = await booking.save({ session });
    });

    if (!restored) return res.status(404).json({ success: false, message: 'Booking not found in archives' });
    return res.json({ success: true, message: 'Booking restored successfully', data: restored });
  } catch (error) {
    if (error && error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An active booking with this reference already exists' });
    }
    return serverError(res, 'Restore booking error', error);
  } finally {
    await session.endSession();
  }
});

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

// GET /api/bookings — all bookings (staff)
router.get('/', auth, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: bookings });
  } catch (error) {
    return serverError(res, 'Get bookings error', error);
  }
});

// GET /api/bookings/availability/:date — remaining seats (public)
router.get('/availability/:date', publicLookupLimiter, async (req, res) => {
  try {
    const { date } = req.params;
    if (!rules.isValidDateString(date)) {
      return res.status(400).json({ success: false, message: 'Date must be YYYY-MM-DD' });
    }
    const { totalSeats, totalBookings } = await seatsUsedOn(date);
    const seatsRemaining = Math.max(0, MAX_DAILY_CAPACITY - totalSeats);
    return res.json({
      success: true,
      data: {
        date,
        seatsRemaining,
        currentSeatsUsed: totalSeats,
        maxCapacity: MAX_DAILY_CAPACITY,
        totalBookings,
        available: seatsRemaining > 0,
        isFull: seatsRemaining <= 0,
      },
    });
  } catch (error) {
    return serverError(res, 'Get availability error', error);
  }
});

// GET /api/bookings/:id — booking status by reference or booking number (public).
// Returns only non-sensitive fields; phone numbers and notes are never exposed.
router.get('/:id', publicLookupLimiter, async (req, res) => {
  try {
    const filter = buildIdFilter(req.params.id);
    if (!filter) return res.status(404).json({ success: false, message: 'Booking not found' });
    const booking = await Booking.findOne(filter).select(PUBLIC_FIELDS).lean();
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    return res.json({ success: true, data: booking });
  } catch (error) {
    return serverError(res, 'Get booking error', error);
  }
});

// PUT /api/bookings/:id — change status (staff)
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    const { status } = req.body;
    if (!EDITABLE_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be: ${EDITABLE_STATUSES.join(', ')}` });
    }
    const filter = buildIdFilter(req.params.id, { allowObjectId: true });
    const booking = filter ? await Booking.findOne(filter) : null;
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = status;
    if (status === 'Cancelled') {
      Object.assign(booking, {
        cancelledAt: new Date(),
        cancelledBy: req.admin.username,
        cancellationReason: 'Manual cancellation',
        archived: true,
        archivedAt: new Date(),
        archiveReason: 'Manual cancellation',
        archivedBy: req.admin.username,
      });
    } else {
      Object.assign(booking, {
        cancelledAt: null, cancelledBy: null, cancellationReason: null, autoCancelled: false,
        archived: false, archivedAt: null, archiveReason: null, archivedBy: null,
      });
    }
    await booking.save();
    return res.json({ success: true, message: 'Booking status updated successfully!', data: booking });
  } catch (error) {
    return serverError(res, 'Update booking status error', error);
  }
});

// DELETE /api/bookings/:id — permanent delete (admin)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    const filter = buildIdFilter(req.params.id, { allowObjectId: true });
    const booking = filter ? await Booking.findOneAndDelete(filter) : null;
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    console.log(`Booking ${booking.referenceNumber} deleted by ${req.admin.username}`);
    return res.json({ success: true, message: 'Booking deleted successfully!', data: { id: booking.id } });
  } catch (error) {
    return serverError(res, 'Delete booking error', error);
  }
});

module.exports = router;
