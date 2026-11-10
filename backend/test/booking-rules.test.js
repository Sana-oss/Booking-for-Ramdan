const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../utils/booking-rules');

test('reference numbers use the 6-character crypto format', () => {
  const seen = new Set();
  for (let i = 0; i < 2000; i++) {
    const ref = rules.generateReferenceNumber();
    assert.match(ref, /^CRT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    seen.add(ref);
  }
  assert.ok(seen.size > 1990, 'references should practically never repeat');
});

test('reference pattern accepts new and legacy formats only', () => {
  assert.ok(rules.isReferenceNumber('CRT-ABCD23'));
  assert.ok(rules.isReferenceNumber('crt-abcd')); // legacy, case-insensitive
  assert.ok(!rules.isReferenceNumber('CRT-ABC'));
  assert.ok(!rules.isReferenceNumber('CRT-ABCDE'));
  assert.ok(!rules.isReferenceNumber({ $ne: null }));
});

test('dates: strict calendar validation', () => {
  assert.ok(rules.isValidDateString('2027-02-28'));
  assert.ok(!rules.isValidDateString('2027-02-31'));
  assert.ok(!rules.isValidDateString('2027-2-3'));
  assert.ok(!rules.isValidDateString('2027-02-28T00:00:00Z'));
});

test('past-date check uses the business timezone (Africa/Tripoli, UTC+2)', () => {
  // 23:30 UTC on 2027-02-10 is already 01:30 on 2027-02-11 in Tripoli
  const now = new Date('2027-02-10T23:30:00Z');
  assert.equal(rules.todayInBusinessTz(now), '2027-02-11');
  assert.ok(rules.isPastDate('2027-02-10', now));
  assert.ok(!rules.isPastDate('2027-02-11', now));
});

test('addDays crosses month boundaries', () => {
  assert.equal(rules.addDays('2027-02-27', 3), '2027-03-02');
});

test('phone normalisation and validation', () => {
  assert.equal(rules.normalizePhone('+218 91-234 5678'), '218912345678');
  assert.ok(rules.isValidPhone('0912345678'));
  assert.ok(!rules.isValidPhone('12345'));
  assert.ok(!rules.isValidPhone('1'.repeat(16)));
});

test('names: Arabic/English letters allowed, markup rejected', () => {
  assert.ok(rules.isValidName('محمد علي'));
  assert.ok(rules.isValidName("Sean O'Neil-Smith"));
  assert.ok(!rules.isValidName('<img src=x onerror=alert(1)>'));
  assert.ok(!rules.isValidName('A'));
  assert.ok(!rules.isValidName('x'.repeat(101)));
  assert.equal(rules.normalizeName('  Ali   Ben  '), 'Ali Ben');
});

test('notes are stripped of markup and capped', () => {
  assert.equal(rules.normalizeNotes('<b>window seat</b>'), 'bwindow seat/b');
  assert.equal(rules.normalizeNotes('x'.repeat(500)).length, rules.NOTES_MAX_LENGTH);
});

test('escapeRegex neutralises regex metacharacters', () => {
  const rx = new RegExp(rules.escapeRegex('(a+)+$'));
  assert.ok(rx.test('(a+)+$'));
  assert.ok(!rx.test('aaaa'));
});
