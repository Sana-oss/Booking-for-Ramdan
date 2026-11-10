const express = require('express');
const { body, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const { auth, requireAdmin, requireStaff } = require('../middleware/auth');
const { createBookingLimiter, publicLookupLimiter } = require('../middleware/security');
const rules = require('../utils/booking-rules');
const { AppError, asyncHandler } = require('../utils/errors');
const svc = require('../services/bookingService');

const router = express.Router();

// The Archives page sends these reasons; 'Manual' is a staff cancellation.
const ARCHIVE_REASON_TO_STATUS = {
  Arrived: 'Arrived',
  'No-Show': 'No-Show',
  Cancelled: 'Cancelled',
  Expired: 'Expired',
  Manual: 'Cancelled',
};
// Statuses listed on the main dashboard (closed ones live on the Archives page,
// except Cancelled, which the dashboard has always shown)
const DASHBOARD_STATUSES = ['Pending', 'Confirmed', 'Cancelled'];

function actorOf(req) {
  return { username: req.admin.username, role: req.admin.role };
}

function throwIfInvalid(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(400, errors.array()[0].msg, { errors: errors.array() });
  }
}

async function loadBooking(rawId) {
  const booking = await svc.findBooking(rawId, { allowObjectId: true });
  if (!booking) throw new AppError(404, 'Booking not found');
  return booking;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

// POST /api/bookings — create a booking
router.post('/', createBookingLimiter, [
  body('name').custom(rules.isValidName).withMessage('Name must be 2-100 letters (Arabic or English)'),
  body('phone').custom(rules.isValidPhone).withMessage('Invalid phone number'),
  body('date').custom(rules.isValidDateString).withMessage('Date must be YYYY-MM-DD'),
  body(['people', 'guests', 'numberOfSeats']).optional()
    .isInt({ min: 1, max: rules.MAX_PARTY_SIZE }).withMessage(`Guests must be 1-${rules.MAX_PARTY_SIZE}`),
  body(['group', 'isGroup']).optional().isBoolean(),
  body('notes').optional().isString().isLength({ max: 1000 }),
], asyncHandler(async (req, res) => {
  throwIfInvalid(req);
  const partySize = parseInt(req.body.numberOfSeats || req.body.people || req.body.guests, 10) || 2;

  const { booking, seatsRemaining, seatsUsed } = await svc.createBooking({
    name: rules.normalizeName(req.body.name),
    phone: rules.normalizePhone(req.body.phone),
    date: req.body.date,
    partySize,
    isGroup: Boolean(req.body.group || req.body.isGroup) || partySize > 10,
    notes: rules.normalizeNotes(req.body.notes),
  });

  res.status(201).json({
    success: true,
    message: 'Booking created successfully!',
    bookingId: booking.id,
    referenceNumber: booking.referenceNumber,
    data: await Booking.findById(booking._id).select(svc.PUBLIC_FIELDS).lean(),
    capacity: { seatsRemaining, currentSeatsUsed: seatsUsed, maxCapacity: rules.MAX_DAILY_CAPACITY },
  });
}));

// GET /api/bookings/availability/:date — remaining seats
router.get('/availability/:date', publicLookupLimiter, asyncHandler(async (req, res) => {
  if (!rules.isValidDateString(req.params.date)) throw new AppError(400, 'Date must be YYYY-MM-DD');
  res.json({ success: true, data: await svc.availability(req.params.date) });
}));

// ---------------------------------------------------------------------------
// Archives (registered before /:id)
// ---------------------------------------------------------------------------

// POST /api/bookings/archive/:id — check-in, no-show or cancel (staff)
router.post('/archive/:id', auth, requireStaff, asyncHandler(async (req, res) => {
  const to = ARCHIVE_REASON_TO_STATUS[req.body.archiveReason];
  if (!to) {
    throw new AppError(400, `Invalid archive reason. Must be one of: ${Object.keys(ARCHIVE_REASON_TO_STATUS).join(', ')}`);
  }
  const booking = await loadBooking(req.params.id);
  const note = rules.normalizeNotes(req.body.notes);
  const updated = await svc.changeStatus(booking, to, actorOf(req), note || req.body.archiveReason);
  res.json({ success: true, message: `Booking marked as '${to}'`, data: updated });
}));

// GET /api/bookings/archive — closed bookings with filters (admin)
router.get('/archive', auth, requireAdmin, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const { search, reason, startDate, endDate } = req.query;
  const query = { status: { $in: rules.CLOSED_STATUSES } };

  if (typeof search === 'string' && search.trim()) {
    const rx = new RegExp(rules.escapeRegex(search.trim().slice(0, 50)), 'i');
    query.$or = [{ name: rx }, { phone: rx }, { referenceNumber: rx }];
  }
  if (typeof reason === 'string' && rules.CLOSED_STATUSES.includes(reason)) query.status = reason;
  if (startDate || endDate) {
    query.archivedAt = {};
    if (startDate) query.archivedAt.$gte = new Date(String(startDate));
    if (endDate) query.archivedAt.$lte = new Date(String(endDate));
  }

  const [items, total, stats] = await Promise.all([
    Booking.find(query).sort({ archivedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Booking.countDocuments(query),
    Booking.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 }, totalGuests: { $sum: '$guests' } } },
    ]),
  ]);

  res.json({
    success: true,
    data: items,
    pagination: { page, pages: Math.ceil(total / limit), total },
    stats: Object.fromEntries(stats.map((s) => [s._id, { count: s.count, totalGuests: s.totalGuests }])),
  });
}));

// GET /api/bookings/archive/stats — counts per closed status (admin)
router.get('/archive/stats', auth, requireAdmin, asyncHandler(async (req, res) => {
  const match = { status: { $in: rules.CLOSED_STATUSES } };
  if (req.query.startDate || req.query.endDate) {
    match.archivedAt = {};
    if (req.query.startDate) match.archivedAt.$gte = new Date(String(req.query.startDate));
    if (req.query.endDate) match.archivedAt.$lte = new Date(String(req.query.endDate));
  }
  const stats = await Booking.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 }, totalGuests: { $sum: '$guests' } } },
  ]);
  const data = Object.fromEntries(stats.map((s) => [s._id, {
    count: s.count,
    totalGuests: s.totalGuests,
    totalGuestsServed: s._id === 'Arrived' ? s.totalGuests : 0,
  }]));
  res.json({ success: true, data });
}));

// POST /api/bookings/restore/:id — reopen a closed booking as Confirmed (admin)
router.post('/restore/:id', auth, requireAdmin, asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  if (!rules.CLOSED_STATUSES.includes(booking.status)) {
    throw new AppError(400, 'Only closed bookings can be restored');
  }
  const updated = await svc.changeStatus(booking, 'Confirmed', actorOf(req), 'Restored from archive');
  res.json({ success: true, message: 'Booking restored successfully', data: updated });
}));

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

// GET /api/bookings — dashboard list (staff). ?status=all includes closed bookings.
router.get('/', auth, asyncHandler(async (req, res) => {
  const filter = req.query.status === 'all' ? {} : { status: { $in: DASHBOARD_STATUSES } };
  const bookings = await Booking.find(filter).select('-statusHistory').sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: bookings });
}));

// GET /api/bookings/:id — public status lookup by reference or booking number.
// Only non-sensitive fields; phone numbers and notes are never exposed.
router.get('/:id', publicLookupLimiter, asyncHandler(async (req, res) => {
  const filter = svc.idFilter(req.params.id);
  const booking = filter ? await Booking.findOne(filter).select(svc.PUBLIC_FIELDS).lean() : null;
  if (!booking) throw new AppError(404, 'Booking not found');
  res.json({ success: true, data: booking });
}));

// GET /api/bookings/:id/history — full record with audit trail (staff)
router.get('/:id/history', auth, asyncHandler(async (req, res) => {
  const booking = await loadBooking(req.params.id);
  res.json({ success: true, data: booking });
}));

// PUT /api/bookings/:id — change status (staff; reopening needs admin)
router.put('/:id', auth, requireStaff, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!DASHBOARD_STATUSES.includes(status)) {
    throw new AppError(400, `Invalid status. Must be: ${DASHBOARD_STATUSES.join(', ')}`);
  }
  const booking = await loadBooking(req.params.id);
  const reason = status === 'Cancelled' ? 'Cancelled by staff' : undefined;
  const updated = await svc.changeStatus(booking, status, actorOf(req), reason);
  res.json({ success: true, message: 'Booking status updated successfully!', data: updated });
}));

// DELETE /api/bookings/:id — permanent delete (admin)
router.delete('/:id', auth, requireAdmin, asyncHandler(async (req, res) => {
  const filter = svc.idFilter(req.params.id, { allowObjectId: true });
  const booking = filter ? await Booking.findOneAndDelete(filter) : null;
  if (!booking) throw new AppError(404, 'Booking not found');
  console.log(`Booking ${booking.referenceNumber} deleted by ${req.admin.username}`);
  res.json({ success: true, message: 'Booking deleted successfully!', data: { id: booking.id } });
}));

module.exports = router;
