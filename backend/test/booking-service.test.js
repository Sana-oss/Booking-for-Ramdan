/**
 * Booking service logic with the Mongoose model stubbed (no database needed).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const svc = require('../services/bookingService');
const { AppError } = require('../utils/errors');

const admin = { username: 'boss', role: 'admin' };
const staff = { username: 'desk', role: 'staff' };

function stubModel(t, { seats = 0, updated = (filter, update) => ({ ...filter, ...update.$set }) } = {}) {
  const calls = [];
  t.mock.method(Booking, 'aggregate', async () => [{ seats, bookings: 1 }]);
  t.mock.method(Booking, 'findOneAndUpdate', async (filter, update) => {
    calls.push({ filter, update });
    return updated(filter, update);
  });
  return calls;
}

const booking = (status, extra = {}) => ({
  _id: new mongoose.Types.ObjectId(), status, date: '2099-03-01', numberOfSeats: 4, ...extra,
});

test('cancelling records closure fields and history, conditioned on current status', async (t) => {
  const calls = stubModel(t);
  const b = booking('Confirmed');
  await svc.changeStatus(b, 'Cancelled', staff, 'Guest called');
  const { filter, update } = calls[0];
  assert.deepEqual(filter, { _id: b._id, status: 'Confirmed' });
  assert.equal(update.$set.status, 'Cancelled');
  assert.equal(update.$set.archivedBy, 'desk');
  assert.equal(update.$set.archiveReason, 'Guest called');
  assert.equal(update.$set.expiresAt, null);
  assert.equal(update.$push.statusHistory.by, 'desk');
});

test('staff cannot reopen a closed booking', async (t) => {
  stubModel(t);
  await assert.rejects(svc.changeStatus(booking('Cancelled'), 'Confirmed', staff),
    (e) => e instanceof AppError && e.status === 403);
});

test('admin restore is blocked when the date is full', async (t) => {
  stubModel(t, { seats: 198 });
  await assert.rejects(svc.changeStatus(booking('No-Show'), 'Confirmed', admin),
    (e) => e instanceof AppError && e.status === 409 && e.extra.seatsRemaining === 2);
});

test('admin restore clears closure fields when capacity allows', async (t) => {
  const calls = stubModel(t, { seats: 100 });
  await svc.changeStatus(booking('Arrived'), 'Confirmed', admin, 'Restored');
  const { $set } = calls[0].update;
  assert.equal($set.archivedAt, null);
  assert.equal($set.archivedBy, null);
  assert.equal($set.expiresAt, null);
});

test('moving back to Pending restarts the expiry window', async (t) => {
  const calls = stubModel(t);
  const before = Date.now();
  await svc.changeStatus(booking('Confirmed'), 'Pending', staff);
  assert.ok(calls[0].update.$set.expiresAt.getTime() > before + 23 * 3600 * 1000);
});

test('illegal transitions are rejected before touching the DB', async (t) => {
  const calls = stubModel(t);
  await assert.rejects(svc.changeStatus(booking('Arrived'), 'Cancelled', admin),
    (e) => e instanceof AppError && e.status === 400);
  assert.equal(calls.length, 0);
});

test('concurrent modification is reported as a conflict', async (t) => {
  stubModel(t, { updated: () => null });
  await assert.rejects(svc.changeStatus(booking('Pending'), 'Confirmed', staff),
    (e) => e instanceof AppError && e.status === 409);
});

test('createBooking rejects past dates, duplicates and full days', async (t) => {
  await assert.rejects(svc.createBooking({ date: '2000-01-01', partySize: 2 }), /past/);

  t.mock.method(Booking, 'exists', async () => ({ _id: 1 }));
  await assert.rejects(svc.createBooking({ phone: '0912345678', date: '2099-03-01', partySize: 2 }),
    (e) => e.status === 409 && /already/.test(e.message));

  Booking.exists.mock.mockImplementation(async () => null);
  t.mock.method(Booking, 'aggregate', async () => [{ seats: 199, bookings: 50 }]);
  await assert.rejects(svc.createBooking({ phone: '0912345678', date: '2099-03-01', partySize: 2 }),
    (e) => e.status === 409 && e.extra.seatsRemaining === 1);
});

test('createBooking backs out when a race pushes the day over capacity', async (t) => {
  t.mock.method(Booking, 'exists', async () => null);
  let n = 0;
  // before insert: 196 seats; after insert (incl. a simultaneous booking): 202
  t.mock.method(Booking, 'aggregate', async () => [{ seats: n++ === 0 ? 196 : 202, bookings: 50 }]);
  const created = { _id: new mongoose.Types.ObjectId() };
  t.mock.method(Booking, 'create', async () => created);
  const del = t.mock.method(Booking, 'deleteOne', async () => ({ deletedCount: 1 }));
  await assert.rejects(
    svc.createBooking({ name: 'A B', phone: '0912345678', date: '2099-03-01', partySize: 4, isGroup: false, notes: '' }),
    (e) => e.status === 409
  );
  assert.equal(del.mock.callCount(), 1);
  assert.deepEqual(del.mock.calls[0].arguments[0], { _id: created._id });
});

test('id filter never parses hex ObjectIds as numbers', () => {
  const hex = '6612abcdef0123456789abcd';
  assert.equal(svc.idFilter(hex), null); // public lookups: no ObjectIds
  assert.ok(svc.idFilter(hex, { allowObjectId: true })._id);
  assert.deepEqual(svc.idFilter('crt-ab23cd'), { referenceNumber: 'CRT-AB23CD' });
  assert.deepEqual(svc.idFilter('1738800000123'), { id: 1738800000123 });
});
