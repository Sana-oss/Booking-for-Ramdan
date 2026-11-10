const express = require('express');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const Booking = require('../models/Booking');
const { auth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const rules = require('../utils/booking-rules');
const { AppError, asyncHandler } = require('../utils/errors');

const router = express.Router();

// ---------------------------------------------------------------------------
// Dashboard data (any signed-in staff)
// ---------------------------------------------------------------------------

router.get('/analytics', auth, asyncHandler(async (req, res) => {
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
        totalRevenue: null, // seats are not priced; revenue is not tracked
        totalBookings,
        totalSeats,
        averagePerBooking: totalBookings > 0 ? Math.round(totalSeats / totalBookings) : 0,
      },
    },
  });
}));

router.get('/capacity', auth, asyncHandler(async (req, res) => {
  const days = Math.min(60, Math.max(1, parseInt(req.query.days, 10) || 7));
  const startDate = rules.todayInBusinessTz();
  const endDate = rules.addDays(startDate, days);
  const max = rules.MAX_DAILY_CAPACITY;

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
}));

// Closed bookings for the Archives page
router.get('/archived-bookings', auth, asyncHandler(async (req, res) => {
  const items = await Booking.find({ status: { $in: rules.CLOSED_STATUSES } })
    .select('-statusHistory')
    .sort({ archivedAt: -1, updatedAt: -1 })
    .lean();
  res.json({
    success: true,
    data: items.map((b) => ({
      ...b,
      archivedAt: b.archivedAt || b.updatedAt || b.createdAt,
      archivedBy: b.archivedBy || 'System',
      archiveReason: b.archiveReason || b.status,
    })),
  });
}));

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const ROLES = ['staff', 'admin', 'superadmin'];
const MANAGEABLE_ROLES = {
  superadmin: ['staff', 'admin', 'superadmin'],
  admin: ['staff'],
};
const canManage = (actor, role) => (MANAGEABLE_ROLES[actor.role] || []).includes(role);
const isValidPassword = (p) => typeof p === 'string' && p.length >= 10 && p.length <= 128;

async function loadUser(id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'Invalid user id');
  const user = await Admin.findById(id);
  if (!user) throw new AppError(404, 'User not found');
  return user;
}

router.get('/users', auth, requireAdmin, asyncHandler(async (req, res) => {
  const users = await Admin.find({}, '-password').sort({ createdAt: 1 });
  res.json({ success: true, data: users });
}));

router.post('/users', auth, requireAdmin, asyncHandler(async (req, res) => {
  const { username, name, password } = req.body;
  const role = req.body.role || 'staff';

  if (typeof username !== 'string' || !/^[a-z0-9._-]{3,50}$/i.test(username.trim())) {
    throw new AppError(400, 'Username must be 3-50 letters, digits, dot, dash or underscore');
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 100) {
    throw new AppError(400, 'Name is required (max 100 characters)');
  }
  if (!isValidPassword(password)) throw new AppError(400, 'Password must be at least 10 characters');
  if (!ROLES.includes(role) || !canManage(req.admin, role)) {
    throw new AppError(403, 'You are not allowed to create a user with this role');
  }

  const normalized = username.trim().toLowerCase();
  if (await Admin.exists({ username: normalized })) throw new AppError(400, 'Username already exists');

  const user = await Admin.create({ username: normalized, name: name.trim(), password, role, isActive: true });
  console.log(`User ${user.username} (${role}) created by ${req.admin.username}`);
  res.json({
    success: true,
    message: 'User created successfully',
    data: { _id: user._id, username: user.username, name: user.name, role: user.role, isActive: user.isActive },
  });
}));

router.put('/users/:id/status', auth, requireSuperAdmin, asyncHandler(async (req, res) => {
  if (typeof req.body.isActive !== 'boolean') throw new AppError(400, 'isActive must be true or false');
  if (String(req.admin._id) === req.params.id) throw new AppError(400, 'لا يمكنك تعطيل حسابك بنفسك');
  const user = await loadUser(req.params.id);
  if (user.role === 'superadmin' && !req.body.isActive
    && (await Admin.countDocuments({ role: 'superadmin', isActive: true })) <= 1) {
    throw new AppError(400, 'لا يمكن تعطيل آخر Super Admin في النظام');
  }
  user.isActive = req.body.isActive;
  await user.save();
  console.log(`User ${user.username} ${user.isActive ? 'activated' : 'deactivated'} by ${req.admin.username}`);
  res.json({ success: true, message: 'User status updated', data: { _id: user._id, isActive: user.isActive } });
}));

router.put('/users/:id/password', auth, requireSuperAdmin, asyncHandler(async (req, res) => {
  if (!isValidPassword(req.body.password)) throw new AppError(400, 'Password must be at least 10 characters');
  const user = await loadUser(req.params.id);
  user.password = req.body.password; // hashed by the model's pre-save hook
  await user.save();
  console.log(`Password for ${user.username} reset by ${req.admin.username}`);
  res.json({ success: true, message: 'Password updated' });
}));

router.delete('/users/:id', auth, requireSuperAdmin, asyncHandler(async (req, res) => {
  if (req.params.id === String(req.admin._id)) throw new AppError(400, 'لا يمكنك حذف حسابك بنفسك');
  const user = await loadUser(req.params.id);
  if (user.role === 'superadmin' && (await Admin.countDocuments({ role: 'superadmin' })) <= 1) {
    throw new AppError(400, 'لا يمكن حذف آخر Super Admin في النظام');
  }
  if (user.role === 'admin' && (await Admin.countDocuments({ role: 'admin' })) <= 1) {
    throw new AppError(400, 'لا يمكن حذف آخر Admin في النظام');
  }
  await Admin.deleteOne({ _id: user._id });
  console.log(`User ${user.username} deleted by ${req.admin.username}`);
  res.json({ success: true, message: 'User deleted successfully' });
}));

module.exports = router;
