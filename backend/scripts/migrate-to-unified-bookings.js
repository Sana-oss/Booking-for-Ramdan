/**
 * Migration: merge the old "bookingarchives" collection into "bookings" and
 * bring every booking up to the unified lifecycle schema.
 *
 *   npm run migrate              # dry run — reports what would change, writes nothing
 *   npm run migrate -- --apply   # backs up both collections to backend/backups/, then migrates
 *
 * Safe to re-run: already-migrated documents are left unchanged.
 */
const fs = require('fs');
const path = require('path');
const { EJSON } = require('mongoose').mongo.BSON;
const rules = require('../utils/booking-rules');

const PRE_MIGRATION = 'Unknown (pre-migration)';
const LEGACY_FIELDS = [
  'archived', 'cancelledAt', 'cancelledBy', 'cancellationReason', 'autoCancelled',
  'restoredFromArchive', 'restoredBy', 'restoredAt', 'originalReference',
];
const STATUS_ALIASES = { 'No Show': 'No-Show', Manual: 'Cancelled', 'ملغي': 'Cancelled' };

function normalizeStatus(value, fallback) {
  const s = STATUS_ALIASES[value] || value;
  return rules.STATUSES.includes(s) ? s : fallback;
}

/** Map a document from the old archive collection to a unified booking. Pure. */
function archiveToBooking(a) {
  const status = normalizeStatus(a.status, null)
    || normalizeStatus(a.archiveReason, 'Cancelled');
  const closedStatus = rules.CLOSED_STATUSES.includes(status) ? status : 'Cancelled';
  const createdAt = a.createdAt || a.archivedAt || new Date(0);
  const archivedAt = a.archivedAt || a.updatedAt || createdAt;
  const archivedBy = a.archivedBy || PRE_MIGRATION;
  const seats = a.numberOfSeats || a.guests || 1;

  return {
    _id: a._id,
    id: a.id,
    referenceNumber: String(a.referenceNumber || a.originalReference || '').toUpperCase(),
    name: a.name,
    phone: rules.normalizePhone(a.phone),
    date: a.date,
    time: a.time || '19:00',
    guests: a.guests || seats,
    numberOfSeats: seats,
    isGroup: Boolean(a.isGroup),
    notes: rules.normalizeNotes(a.notes),
    status: closedStatus,
    statusHistory: [
      { status: 'Pending', at: createdAt, by: 'Guest', reason: 'Online booking' },
      { status: closedStatus, at: archivedAt, by: archivedBy, reason: 'Migrated from archive collection' },
    ],
    createdAt,
    expiresAt: null,
    archivedAt,
    archiveReason: a.archiveReason || closedStatus,
    archivedBy,
    updatedAt: a.updatedAt || archivedAt,
  };
}

/**
 * Compute the update that brings an existing booking to the unified schema.
 * Returns null when nothing needs to change. Pure.
 */
function upgradeBooking(b) {
  const set = {};
  const unset = {};
  const status = normalizeStatus(b.status, 'Cancelled');
  if (status !== b.status) set.status = status;

  const phone = rules.normalizePhone(b.phone);
  if (phone !== b.phone) set.phone = phone;
  if (!b.numberOfSeats) set.numberOfSeats = b.guests || 1;
  if (b.referenceNumber && b.referenceNumber !== b.referenceNumber.toUpperCase()) {
    set.referenceNumber = b.referenceNumber.toUpperCase();
  }

  const createdAt = b.createdAt || b.updatedAt || new Date(0);
  if (!Array.isArray(b.statusHistory) || b.statusHistory.length === 0) {
    const history = [{ status: 'Pending', at: createdAt, by: 'Guest', reason: 'Online booking' }];
    if (status !== 'Pending') {
      history.push({
        status,
        at: b.archivedAt || b.cancelledAt || b.updatedAt || createdAt,
        by: b.archivedBy || b.cancelledBy || (b.autoCancelled ? 'System' : PRE_MIGRATION),
        reason: b.cancellationReason || 'Recorded before migration',
      });
    }
    set.statusHistory = history;
  }

  if (rules.CLOSED_STATUSES.includes(status)) {
    if (!b.archivedAt) set.archivedAt = b.cancelledAt || b.updatedAt || createdAt;
    if (!b.archiveReason) set.archiveReason = b.autoCancelled ? 'Expired' : status;
    if (!b.archivedBy) set.archivedBy = b.cancelledBy || (b.autoCancelled ? 'System' : PRE_MIGRATION);
    if (b.expiresAt) set.expiresAt = null;
  } else {
    for (const f of ['archivedAt', 'archiveReason', 'archivedBy']) if (b[f]) set[f] = null;
    if (status === 'Pending' && !b.expiresAt) set.expiresAt = rules.pendingExpiryFrom(createdAt);
    if (status === 'Confirmed' && b.expiresAt) set.expiresAt = null;
  }

  for (const f of LEGACY_FIELDS) if (f in b) unset[f] = '';

  const update = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  return Object.keys(update).length ? update : null;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const config = require('../config/env');
  const mongoose = require('mongoose');

  await mongoose.connect(config.MONGODB_URI, { dbName: config.MONGODB_DB_NAME });
  const db = mongoose.connection.db;
  const bookingsCol = db.collection('bookings');
  const archiveCol = db.collection('bookingarchives');

  try {
    const bookings = await bookingsCol.find({}).toArray();
    const archives = (await db.listCollections({ name: 'bookingarchives' }).toArray()).length
      ? await archiveCol.find({}).toArray()
      : [];

    console.log(`Database: ${db.databaseName}`);
    console.log(`bookings: ${bookings.length}   bookingarchives: ${archives.length}`);

    // --- Plan archive moves, detecting conflicts with existing bookings
    const refs = new Set(bookings.map((b) => String(b.referenceNumber || '').toUpperCase()));
    const ids = new Set(bookings.map((b) => b.id));
    const _ids = new Set(bookings.map((b) => String(b._id)));
    const moves = [];
    const conflicts = [];
    for (const a of archives) {
      const doc = archiveToBooking(a);
      if (!doc.referenceNumber || refs.has(doc.referenceNumber) || ids.has(doc.id) || _ids.has(String(doc._id))) {
        conflicts.push(doc.referenceNumber || String(a._id));
      } else {
        moves.push(doc);
        refs.add(doc.referenceNumber);
        ids.add(doc.id);
      }
    }

    // --- Plan upgrades of existing bookings
    const upgrades = bookings
      .map((b) => ({ _id: b._id, ref: b.referenceNumber, update: upgradeBooking(b) }))
      .filter((u) => u.update);

    console.log(`\nPlan:`);
    console.log(`  move from archive → bookings : ${moves.length}`);
    moves.forEach((m) => console.log(`     ${m.referenceNumber}  ${m.status}`));
    console.log(`  upgrade existing bookings    : ${upgrades.length}`);
    console.log(`  conflicts (left in archive)  : ${conflicts.length}${conflicts.length ? ` → ${conflicts.join(', ')}` : ''}`);

    const indexes = await bookingsCol.indexes();
    const textIndex = indexes.find((i) => i.key && i.key._fts === 'text');
    if (textIndex) console.log(`  drop unused text index       : ${textIndex.name}`);

    if (!apply) {
      console.log('\nDry run only — nothing was written. Re-run with --apply to migrate.');
      return;
    }

    // --- Backup
    const dir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `pre-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    fs.writeFileSync(file, EJSON.stringify({ bookings, bookingarchives: archives }, { relaxed: false }));
    console.log(`\nBackup written: ${file}`);

    // --- Apply in one transaction
    const session = mongoose.connection.client.startSession();
    try {
      await session.withTransaction(async () => {
        if (moves.length) {
          await bookingsCol.insertMany(moves, { session });
          await archiveCol.deleteMany({ _id: { $in: moves.map((m) => m._id) } }, { session });
        }
        for (const u of upgrades) {
          // eslint-disable-next-line no-await-in-loop
          await bookingsCol.updateOne({ _id: u._id }, u.update, { session });
        }
      });
    } finally {
      await session.endSession();
    }
    console.log(`Moved ${moves.length}, upgraded ${upgrades.length}.`);

    if (textIndex) {
      await bookingsCol.dropIndex(textIndex.name);
      console.log(`Dropped index ${textIndex.name}`);
    }
    if (!conflicts.length && (await archiveCol.countDocuments()) === 0 && archives.length) {
      await archiveCol.drop();
      console.log('Dropped empty "bookingarchives" collection.');
    }
    if (conflicts.length) {
      console.log('⚠️  Some archive records conflict with existing bookings and were left in place. Resolve them manually.');
    }
    console.log('✅ Migration complete.');
  } finally {
    await mongoose.connection.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { archiveToBooking, upgradeBooking };
