const config = require('./config/env'); // validates env first; exits on bad config
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const { rejectOperatorKeys } = require('./middleware/security');
const { auth, requireAdmin, requireSuperAdmin } = require('./middleware/auth');
const Admin = require('./models/Admin');
const Booking = require('./models/Booking');
const BookingArchive = require('./models/BookingArchive');
const rules = require('./utils/booking-rules');

mongoose.set('runValidators', true); // enforce schema validation on updates too

const app = express();
const frontendPath = path.join(__dirname, '..', 'frontend');

// Behind Cloudflare Tunnel / a reverse proxy on the same host
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');

// ============================================
// 1. SECURITY MIDDLEWARE
// ============================================
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // The current pages still use inline <script> blocks and onclick=""
      // handlers, so 'unsafe-inline' is required until the frontend refactor
      // removes them. The policy still blocks scripts from any other origin,
      // plugins, framing, and exfiltration via fetch/XHR to other hosts.
      'script-src': ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      'script-src-attr': ["'unsafe-inline'"],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'connect-src': ["'self'"],
      'frame-ancestors': ["'none'"],
      'form-action': ["'self'"],
      'upgrade-insecure-requests': config.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Same-origin by default; extra origins only if explicitly configured
app.use(cors({ origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : false }));
app.use(express.json({ limit: '20kb' }));
app.use(rejectOperatorKeys);

// ============================================
// 2. API ROUTES
// ============================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/bookings', require('./routes/bookings'));

function serverError(res, label, error) {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: 'Server error' });
}

// --- Analytics Dashboard Data ---
app.get('/api/admin/analytics', auth, async (req, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [statusDistribution, weeklyTrends, totals] = await Promise.all([
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: rules.BUSINESS_TIMEZONE } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $match: { status: { $in: rules.ACTIVE_STATUSES } } },
        { $group: { _id: null, totalSeats: { $sum: '$numberOfSeats' }, totalBookings: { $sum: 1 } } },
      ]),
    ]);

    const totalSeats = totals[0] ? totals[0].totalSeats : 0;
    const totalBookings = totals[0] ? totals[0].totalBookings : 0;

    res.json({
      success: true,
      data: {
        statusDistribution,
        weeklyTrends,
        summary: {
          // Iftar seats are not priced in the system; revenue is not tracked.
          // (The previous value was seats × an assumed 50 LYD.)
          totalRevenue: null,
          totalBookings,
          totalSeats,
          averagePerBooking: totalBookings > 0 ? Math.round(totalSeats / totalBookings) : 0,
        },
      },
    });
  } catch (error) {
    serverError(res, 'Analytics error', error);
  }
});

// --- Daily Capacity Overview ---
app.get('/api/admin/capacity', auth, async (req, res) => {
  try {
    const days = Math.min(60, Math.max(1, parseInt(req.query.days, 10) || 7));
    const startDate = rules.todayInBusinessTz();
    const endDate = rules.addDays(startDate, days);

    const capacityData = await Booking.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate }, status: { $in: rules.ACTIVE_STATUSES } } },
      {
        $group: {
          _id: '$date',
          totalSeats: { $sum: '$numberOfSeats' },
          bookingCount: { $sum: 1 },
          pendingCount: { $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } },
          confirmedCount: { $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const max = rules.MAX_DAILY_CAPACITY;
    res.json({
      success: true,
      data: {
        dailyCapacity: capacityData.map((day) => {
          const percentage = Math.round((day.totalSeats / max) * 100);
          return {
            date: day._id,
            totalSeats: day.totalSeats,
            seatsRemaining: Math.max(0, max - day.totalSeats),
            bookingCount: day.bookingCount,
            pendingCount: day.pendingCount,
            confirmedCount: day.confirmedCount,
            maxCapacity: max,
            capacityPercentage: percentage,
            isWarning: percentage >= 80,
            isFull: day.totalSeats >= max,
          };
        }),
        maxCapacity: max,
        warningThreshold: 80,
      },
    });
  } catch (error) {
    serverError(res, 'Capacity overview error', error);
  }
});

// --- Archived / cancelled bookings for the Archives page ---
// Combines the archive collection with cancelled bookings still in `bookings`.
app.get('/api/admin/archived-bookings', auth, async (req, res) => {
  try {
    const [fromArchive, cancelled] = await Promise.all([
      BookingArchive.find({}).sort({ archivedAt: -1 }).lean(),
      Booking.find({ status: 'Cancelled' }).sort({ updatedAt: -1 }).lean(),
    ]);

    const archiveRefs = new Set(fromArchive.map((a) => a.referenceNumber));
    const entries = [
      ...fromArchive.map((b) => ({
        ...b,
        archivedAt: b.archivedAt || b.createdAt,
        archivedBy: b.archivedBy || 'System',
        _source: 'archive',
      })),
      ...cancelled
        .filter((b) => !archiveRefs.has(b.referenceNumber))
        .map((b) => ({
          ...b,
          archivedAt: b.archivedAt || b.cancelledAt || b.updatedAt || b.createdAt,
          archivedBy: b.archivedBy || b.cancelledBy || (b.autoCancelled ? 'System' : 'Staff'),
          archiveReason: b.archiveReason || (b.autoCancelled ? 'Auto-expiry' : 'Cancelled'),
          _source: 'booking',
        })),
    ].sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

    res.json({ success: true, data: entries });
  } catch (error) {
    serverError(res, 'Archived bookings fetch error', error);
  }
});

// ============================================
// AUTO-CANCELLATION: Pending bookings expire after PENDING_EXPIRY_HOURS
// ============================================
async function autoCancelExpiredBookings() {
  if (mongoose.connection.readyState !== 1) return 0;
  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - rules.PENDING_EXPIRY_HOURS * 60 * 60 * 1000);
    const result = await Booking.updateMany(
      { status: 'Pending', createdAt: { $lt: cutoff } },
      {
        $set: {
          status: 'Cancelled',
          expiresAt: null,
          cancellationReason: `Auto-expired after ${rules.PENDING_EXPIRY_HOURS} hours`,
          autoCancelled: true,
          cancelledAt: now,
          cancelledBy: 'System',
          archived: true,
          archivedAt: now,
          archiveReason: 'Auto-expiry',
          archivedBy: 'System',
        },
      }
    );
    if (result.modifiedCount > 0) {
      console.log(`[auto-expiry] ${result.modifiedCount} pending booking(s) cancelled`);
    }
    return result.modifiedCount;
  } catch (err) {
    console.error('[auto-expiry] error:', err);
    return 0;
  }
}

// ============================================
// USERS MANAGEMENT
// ============================================
const ROLES = ['staff', 'admin', 'superadmin'];
// Which roles each role may create or manage
const MANAGEABLE_ROLES = {
  superadmin: ['staff', 'admin', 'superadmin'],
  admin: ['staff'],
};
const canManage = (actor, targetRole) => (MANAGEABLE_ROLES[actor.role] || []).includes(targetRole);
const isValidPassword = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 128;

app.get('/api/admin/users', auth, requireAdmin, async (req, res) => {
  try {
    const users = await Admin.find({}, '-password').sort({ createdAt: 1 });
    res.json({ success: true, data: users });
  } catch (error) {
    serverError(res, 'List users error', error);
  }
});

app.post('/api/admin/users', auth, requireAdmin, async (req, res) => {
  try {
    const { username, name, password } = req.body;
    const role = req.body.role || 'staff';

    if (typeof username !== 'string' || !/^[a-z0-9._-]{3,50}$/i.test(username.trim())) {
      return res.status(400).json({ success: false, message: 'Username must be 3-50 letters, digits, dot, dash or underscore' });
    }
    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name is required (max 100 characters)' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 10 characters' });
    }
    if (!ROLES.includes(role) || !canManage(req.admin, role)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to create a user with this role' });
    }

    const normalized = username.trim().toLowerCase();
    if (await Admin.exists({ username: normalized })) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const newAdmin = await Admin.create({ username: normalized, name: name.trim(), password, role, isActive: true });
    console.log(`User ${newAdmin.username} (${role}) created by ${req.admin.username}`);
    res.json({
      success: true,
      message: 'User created successfully',
      data: { _id: newAdmin._id, username: newAdmin.username, name: newAdmin.name, role: newAdmin.role, isActive: newAdmin.isActive },
    });
  } catch (error) {
    serverError(res, 'Create user error', error);
  }
});

// Activate / deactivate a user (superadmin)
app.put('/api/admin/users/:id/status', auth, requireSuperAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be true or false' });
    if (String(req.admin._id) === req.params.id) {
      return res.status(400).json({ success: false, message: 'لا يمكنك تعطيل حسابك بنفسك' });
    }
    const user = await Admin.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.role === 'superadmin' && !req.body.isActive) {
      const activeSupers = await Admin.countDocuments({ role: 'superadmin', isActive: true });
      if (activeSupers <= 1) return res.status(400).json({ success: false, message: 'لا يمكن تعطيل آخر Super Admin في النظام' });
    }
    user.isActive = req.body.isActive;
    await user.save();
    console.log(`User ${user.username} ${user.isActive ? 'activated' : 'deactivated'} by ${req.admin.username}`);
    res.json({ success: true, message: 'User status updated', data: { _id: user._id, isActive: user.isActive } });
  } catch (error) {
    serverError(res, 'Update user status error', error);
  }
});

// Reset another user's password (superadmin)
app.put('/api/admin/users/:id/password', auth, requireSuperAdmin, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    if (!isValidPassword(req.body.password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 10 characters' });
    }
    const user = await Admin.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.password = req.body.password; // hashed by the model's pre-save hook
    await user.save();
    console.log(`Password for ${user.username} reset by ${req.admin.username}`);
    res.json({ success: true, message: 'Password updated' });
  } catch (error) {
    serverError(res, 'Reset password error', error);
  }
});

app.delete('/api/admin/users/:id', auth, requireSuperAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.isValidObjectId(userId)) return res.status(400).json({ success: false, message: 'Invalid user id' });
    if (userId === req.admin._id.toString()) {
      return res.status(400).json({ success: false, message: 'لا يمكنك حذف حسابك بنفسك' });
    }
    const userToDelete = await Admin.findById(userId);
    if (!userToDelete) return res.status(404).json({ success: false, message: 'User not found' });

    if (userToDelete.role === 'superadmin' && (await Admin.countDocuments({ role: 'superadmin' })) <= 1) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف آخر Super Admin في النظام' });
    }
    if (userToDelete.role === 'admin' && (await Admin.countDocuments({ role: 'admin' })) <= 1) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف آخر Admin في النظام' });
    }

    await Admin.findByIdAndDelete(userId);
    console.log(`User ${userToDelete.username} deleted by ${req.admin.username}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    serverError(res, 'Delete user error', error);
  }
});

// --- Health Check ---
app.get('/health', (req, res) => {
  const up = mongoose.connection.readyState === 1;
  res.status(up ? 200 : 503).json({ status: up ? 'OK' : 'DEGRADED', mongodb: up ? 'Connected' : 'Disconnected' });
});

// Unknown API routes → JSON 404 (before static/HTML fallbacks)
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// ============================================
// 3. STATIC FRONTEND
// ============================================
// Never serve documentation, configs, or scripts that live in the frontend folder
app.use((req, res, next) => {
  if (/\.(md|ya?ml|sh|conf|lst|env|example|txt|json)$/i.test(req.path)) return res.status(404).end();
  next();
});
app.use(express.static(frontendPath, { dotfiles: 'deny', index: 'index.html' }));

const pages = {
  '/': 'index.html',
  '/admin': 'admin-dashboard.html',
  '/check-status': 'check-status.html',
  '/success': 'success.html',
  '/admin-login': 'admin-login.html',
  '/archives': 'archives.html',
  '/users-management': 'users-management.html',
};
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(frontendPath, file)));
});
app.get('*', (req, res) => res.sendFile(path.join(frontendPath, 'index.html')));

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request too large' });
  }
  console.error('Unhandled error:', err);
  return res.status(500).json({ success: false, message: 'Server error' });
});

// ============================================
// STARTUP
// ============================================
async function start() {
  try {
    await mongoose.connect(config.MONGODB_URI, {
      dbName: config.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    // Log the host only — never the connection string (it contains credentials)
    console.log(`✅ Connected to MongoDB (${mongoose.connection.host}/${mongoose.connection.name})`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }

  await autoCancelExpiredBookings();
  setInterval(autoCancelExpiredBookings, 10 * 60 * 1000).unref();

  app.listen(config.PORT, () => {
    console.log(`🚀 Server running on http://localhost:${config.PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, autoCancelExpiredBookings };
