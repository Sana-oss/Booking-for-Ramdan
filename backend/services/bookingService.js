/**
 * Booking domain logic. Routes stay thin: they validate HTTP input, call these
 * functions, and shape the response.
 */
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const rules = require('../utils/booking-rules');
const { AppError } = require('../utils/errors');

const { MAX_DAILY_CAPACITY, ACTIVE_STATUSES, CLOSED_STATUSES } = rules;

// Fields a guest may see on the public status / success pages (no phone, no notes)
const PUBLIC_FIELDS = 'id referenceNumber name date time guests numberOfSeats isGroup status createdAt expiresAt';

function generateBookingId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

/**
 * Resolve a booking identifier: a CRT reference, a numeric legacy id, or
 * (only when allowObjectId) a 24-hex Mongo _id.
 */
function idFilter(rawId, { allowObjectId = false } = {}) {
  const id = String(rawId || '').trim();
  if (rules.isReferenceNumber(id)) return { referenceNumber: id.toUpperCase() };
  if (allowObjectId && /^[a-f0-9]{24}$/i.test(id)) return { _id: new mongoose.Types.ObjectId(id) };
  if (/^\d{1,18}$/.test(id)) return { id: Number(id) };
  return null;
}

async function findBooking(rawId, options) {
  const filter = idFilter(rawId, options);
  return filter ? Booking.findOne(filter) : null;
}

async function seatsUsedOn(date) {
  const [agg] = await Booking.aggregate([
    { $match: { date, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: null, seats: { $sum: '$numberOfSeats' }, bookings: { $sum: 1 } } },
  ]);
  return { seats: agg ? agg.seats : 0, bookings: agg ? agg.bookings : 0 };
}

async function availability(date) {
  const { seats, bookings } = await seatsUsedOn(date);
  const seatsRemaining = Math.max(0, MAX_DAILY_CAPACITY - seats);
  return {
    date,
    seatsRemaining,
    currentSeatsUsed: seats,
    maxCapacity: MAX_DAILY_CAPACITY,
    totalBookings: bookings,
    available: seatsRemaining > 0,
    isFull: seatsRemaining <= 0,
  };
}

function capacityError(seatsRemaining) {
  return new AppError(409, seatsRemaining > 0
    ? `Capacity reached for this date. Only ${seatsRemaining} seats remaining.`
    : 'This date is fully booked. Please choose another date.',
  { seatsRemaining, maxCapacity: MAX_DAILY_CAPACITY });
}

/**
 * Create a guest booking. Input must already be validated by the route.
 * Never overbooks: capacity is re-checked after insert and the new booking
 * backs out if simultaneous requests pushed the day over the limit.
 */
async function createBooking({ name, phone, date, partySize, isGroup, notes }) {
  if (rules.isPastDate(date)) throw new AppError(400, 'Cannot book for past dates');

  if (await Booking.exists({ phone, date, status: { $in: ACTIVE_STATUSES } })) {
    throw new AppError(409, 'You already have a booking for this date');
  }

  const before = await seatsUsedOn(date);
  if (before.seats + partySize > MAX_DAILY_CAPACITY) {
    throw capacityError(Math.max(0, MAX_DAILY_CAPACITY - before.seats));
  }

  const now = new Date();
  const booking = await Booking.create({
    id: generateBookingId(),
    name,
    phone,
    date,
    guests: partySize,
    numberOfSeats: partySize,
    isGroup,
    notes,
    status: 'Pending',
    createdAt: now,
    statusHistory: [{ status: 'Pending', at: now, by: 'Guest', reason: 'Online booking' }],
  });

  const after = await seatsUsedOn(date);
  if (after.seats > MAX_DAILY_CAPACITY) {
    await Booking.deleteOne({ _id: booking._id });
    throw capacityError(Math.max(0, MAX_DAILY_CAPACITY - (after.seats - partySize)));
  }

  return { booking, seatsRemaining: Math.max(0, MAX_DAILY_CAPACITY - after.seats), seatsUsed: after.seats };
}

/**
 * Move a booking to a new status, atomically and with an audit entry.
 *
 * @param {object} booking   current booking document
 * @param {string} to        target status
 * @param {object} actor     { username, role }
 * @param {string} [reason]  shown in history and as the archive reason
 */
async function changeStatus(booking, to, actor, reason) {
  const from = booking.status;
  if (!rules.STATUSES.includes(to)) throw new AppError(400, `Invalid status: ${to}`);
  if (from === to) return booking;
  if (!rules.canTransition(from, to)) {
    throw new AppError(400, `A booking cannot go from ${from} to ${to}`);
  }

  const reopening = rules.isReopen(from, to);
  if (reopening) {
    if (!['admin', 'superadmin'].includes(actor.role)) {
      throw new AppError(403, 'Only an admin can restore a closed booking');
    }
    const { seats } = await seatsUsedOn(booking.date);
    if (seats + booking.numberOfSeats > MAX_DAILY_CAPACITY) {
      throw capacityError(Math.max(0, MAX_DAILY_CAPACITY - seats));
    }
  }

  const now = new Date();
  const set = { status: to };
  if (CLOSED_STATUSES.includes(to)) {
    Object.assign(set, {
      expiresAt: null,
      archivedAt: now,
      archiveReason: reason || to,
      archivedBy: actor.username,
    });
  } else {
    Object.assign(set, {
      archivedAt: null,
      archiveReason: null,
      archivedBy: null,
      // Re-entering Pending restarts the confirmation window
      expiresAt: to === 'Pending' ? rules.pendingExpiryFrom(now) : null,
    });
  }

  const historyEntry = { status: to, at: now, by: actor.username };
  if (reason) historyEntry.reason = String(reason).slice(0, 500);

  // Conditional on the status we read, so two staff acting at once cannot
  // silently overwrite each other.
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: from },
    { $set: set, $push: { statusHistory: historyEntry } },
    { new: true }
  );
  if (!updated) throw new AppError(409, 'This booking was just changed by someone else. Please refresh.');
  return updated;
}

/** Expire Pending bookings whose confirmation window has passed. */
async function expirePendingBookings(now = new Date()) {
  const legacyCutoff = new Date(now.getTime() - rules.PENDING_EXPIRY_HOURS * 60 * 60 * 1000);
  const reason = `Not confirmed within ${rules.PENDING_EXPIRY_HOURS} hours`;
  const result = await Booking.updateMany(
    {
      status: 'Pending',
      $or: [
        { expiresAt: { $lte: now } },
        { expiresAt: null, createdAt: { $lt: legacyCutoff } },
      ],
    },
    {
      $set: {
        status: 'Expired',
        expiresAt: null,
        archivedAt: now,
        archiveReason: 'Expired',
        archivedBy: 'System',
      },
      $push: { statusHistory: { status: 'Expired', at: now, by: 'System', reason } },
    }
  );
  return result.modifiedCount;
}

module.exports = {
  PUBLIC_FIELDS,
  idFilter,
  findBooking,
  seatsUsedOn,
  availability,
  createBooking,
  changeStatus,
  expirePendingBookings,
};
