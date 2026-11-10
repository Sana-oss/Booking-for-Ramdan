const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const rules = require('../utils/booking-rules');
const { archiveToBooking, upgradeBooking } = require('../scripts/migrate-to-unified-bookings');
const Booking = require('../models/Booking');

test('status transitions', () => {
  assert.ok(rules.canTransition('Pending', 'Confirmed'));
  assert.ok(rules.canTransition('Confirmed', 'Arrived'));
  assert.ok(rules.canTransition('Cancelled', 'Confirmed'));
  assert.ok(!rules.canTransition('Arrived', 'Cancelled'));
  assert.ok(!rules.canTransition('Expired', 'Arrived'));
  assert.ok(!rules.canTransition('Pending', 'Bogus'));
  assert.ok(rules.isReopen('No-Show', 'Confirmed'));
  assert.ok(!rules.isReopen('Pending', 'Confirmed'));
});

// Shapes below mirror the live data (field names/types inspected on Atlas).
const archiveDoc = {
  _id: new mongoose.Types.ObjectId(),
  id: 1738800000123,
  referenceNumber: 'CRT-AB23',
  name: 'Test Guest',
  phone: '0912345678',
  date: '2026-02-20',
  guests: 4,
  numberOfSeats: 4,
  isGroup: false,
  status: 'Arrived',
  createdAt: new Date('2026-02-10T10:00:00Z'),
  expiresAt: null,
  archiveReason: 'Arrived',
  archivedAt: new Date('2026-02-20T17:00:00Z'),
  originalReference: 'CRT-AB23',
  archivedBy: 'staff1',
  notes: '',
  updatedAt: new Date('2026-02-20T17:00:00Z'),
  __v: 0,
};

test('archive record maps to a valid unified booking', async () => {
  const doc = archiveToBooking(archiveDoc);
  assert.equal(doc.status, 'Arrived');
  assert.equal(doc._id, archiveDoc._id);
  assert.equal(doc.archivedBy, 'staff1');
  assert.equal(doc.statusHistory.length, 2);
  assert.equal(doc.statusHistory[1].status, 'Arrived');
  assert.ok(!('originalReference' in doc));
  await new Booking(doc).validate(); // passes the real schema
});

test('archive aliases are normalised', () => {
  assert.equal(archiveToBooking({ ...archiveDoc, status: 'No Show' }).status, 'No-Show');
  assert.equal(archiveToBooking({ ...archiveDoc, status: undefined, archiveReason: 'Manual' }).status, 'Cancelled');
});

const cancelledLegacy = {
  _id: new mongoose.Types.ObjectId(),
  id: 1738800000456,
  referenceNumber: 'CRT-CD45',
  name: 'Other Guest',
  phone: '0923456789',
  date: '2026-02-21',
  time: '19:00',
  guests: 2,
  numberOfSeats: 2,
  isGroup: false,
  status: 'Cancelled',
  createdAt: new Date('2026-02-11T10:00:00Z'),
  expiresAt: new Date('2026-02-12T10:00:00Z'),
  updatedAt: new Date('2026-02-12T10:05:00Z'),
  __v: 0,
};

test('legacy cancelled booking gets closure fields and history', async () => {
  const update = upgradeBooking(cancelledLegacy);
  assert.ok(update && update.$set);
  assert.equal(update.$set.archiveReason, 'Cancelled');
  assert.equal(update.$set.archivedBy, 'Unknown (pre-migration)');
  assert.deepEqual(update.$set.archivedAt, cancelledLegacy.updatedAt);
  assert.equal(update.$set.expiresAt, null);
  assert.equal(update.$set.statusHistory.length, 2);
  await new Booking({ ...cancelledLegacy, ...update.$set }).validate();
});

test('confirmed legacy booking only needs history', () => {
  const update = upgradeBooking({ ...cancelledLegacy, status: 'Confirmed', expiresAt: null });
  assert.deepEqual(Object.keys(update.$set), ['statusHistory']);
});

test('upgrade is idempotent', () => {
  const once = upgradeBooking(cancelledLegacy);
  const migrated = { ...cancelledLegacy, ...once.$set };
  assert.equal(upgradeBooking(migrated), null);
  assert.equal(upgradeBooking(archiveToBooking(archiveDoc)), null);
});

test('legacy fields are removed', () => {
  const update = upgradeBooking({ ...cancelledLegacy, archived: true, autoCancelled: true, cancelledAt: new Date() });
  assert.deepEqual(Object.keys(update.$unset).sort(), ['archived', 'autoCancelled', 'cancelledAt']);
  assert.equal(update.$set.archiveReason, 'Expired'); // auto-cancelled ⇒ expired
  assert.equal(update.$set.archivedBy, 'System');
});
