/**
 * Booking business rules and input normalisation shared by routes and jobs.
 * Pure functions only (no DB access) so they can be unit-tested.
 */
const crypto = require('crypto');

const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Africa/Tripoli';
const MAX_DAILY_CAPACITY = parseInt(process.env.MAX_DAILY_CAPACITY, 10) || 200;
const PENDING_EXPIRY_HOURS = parseInt(process.env.PENDING_EXPIRY_HOURS, 10) || 24;
const MAX_PARTY_SIZE = 200;
const NAME_MAX_LENGTH = 100;
const NOTES_MAX_LENGTH = 300;

// Booking lifecycle
const STATUSES = ['Pending', 'Confirmed', 'Cancelled', 'Expired', 'Arrived', 'No-Show'];
// Statuses that hold seats against daily capacity
const ACTIVE_STATUSES = ['Pending', 'Confirmed'];
// Closed statuses appear on the Archives page
const CLOSED_STATUSES = ['Cancelled', 'Expired', 'Arrived', 'No-Show'];

/**
 * Allowed status transitions. Re-opening a closed booking (to Pending or
 * Confirmed) is a "restore" and needs admin rights plus free capacity.
 */
const TRANSITIONS = {
  Pending: ['Confirmed', 'Cancelled', 'Expired', 'Arrived', 'No-Show'],
  Confirmed: ['Pending', 'Cancelled', 'Arrived', 'No-Show'],
  Cancelled: ['Pending', 'Confirmed'],
  Expired: ['Pending', 'Confirmed'],
  Arrived: ['Confirmed'],
  'No-Show': ['Confirmed'],
};

function canTransition(from, to) {
  return Boolean(TRANSITIONS[from] && TRANSITIONS[from].includes(to));
}

function isReopen(from, to) {
  return CLOSED_STATUSES.includes(from) && ACTIVE_STATUSES.includes(to);
}

// Reference numbers: CRT- + 6 chars from an unambiguous alphabet (32^6 ≈ 1.07e9).
// Legacy references (CRT- + 4 chars) remain valid for lookup.
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REF_LENGTH = 6;
const REF_PATTERN = /^CRT-[A-Z0-9]{4}(?:[A-Z0-9]{2})?$/i;

function generateReferenceNumber() {
  const bytes = crypto.randomBytes(REF_LENGTH);
  let out = 'CRT-';
  for (let i = 0; i < REF_LENGTH; i++) {
    out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length]; // 256 % 32 === 0 → unbiased
  }
  return out;
}

function isReferenceNumber(value) {
  return typeof value === 'string' && REF_PATTERN.test(value.trim());
}

/** Today's date (YYYY-MM-DD) in the restaurant's timezone, not the server's. */
function todayInBusinessTz(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE });
}

/** Add whole days to a YYYY-MM-DD string, returning YYYY-MM-DD. */
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Strict calendar-date check for YYYY-MM-DD (rejects 2026-02-31). */
function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isPastDate(dateStr, now = new Date()) {
  return dateStr < todayInBusinessTz(now); // lexical compare is safe for YYYY-MM-DD
}

/** Keep digits only (a leading + is dropped; duplicates compare on digits). */
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function isValidPhone(phone) {
  const digits = normalizePhone(phone);
  return digits.length >= 9 && digits.length <= 15;
}

// Letters (Latin + Arabic), spaces, and a few name punctuation marks. No markup.
const NAME_PATTERN = /^[A-Za-z؀-ۿݐ-ݿ\s.'-]+$/;

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function isValidName(name) {
  const n = normalizeName(name);
  return n.length >= 2 && n.length <= NAME_MAX_LENGTH && NAME_PATTERN.test(n);
}

/** Notes: strip angle brackets and control chars, trim, cap length. */
function normalizeNotes(notes) {
  return String(notes || '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, NOTES_MAX_LENGTH);
}

function pendingExpiryFrom(createdAt) {
  return new Date(createdAt.getTime() + PENDING_EXPIRY_HOURS * 60 * 60 * 1000);
}

/** Escape a user string for safe use inside a RegExp. */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  BUSINESS_TIMEZONE,
  MAX_DAILY_CAPACITY,
  PENDING_EXPIRY_HOURS,
  MAX_PARTY_SIZE,
  NOTES_MAX_LENGTH,
  STATUSES,
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  TRANSITIONS,
  canTransition,
  isReopen,
  generateReferenceNumber,
  isReferenceNumber,
  todayInBusinessTz,
  addDays,
  isValidDateString,
  isPastDate,
  normalizePhone,
  isValidPhone,
  normalizeName,
  isValidName,
  normalizeNotes,
  pendingExpiryFrom,
  escapeRegex,
};
