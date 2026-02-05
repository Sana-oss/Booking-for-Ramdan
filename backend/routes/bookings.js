const express = require('express');
const mongoose = require('mongoose');
const { body, param, validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const BookingArchive = require('../models/BookingArchive');
const { auth, requireAdmin, requireStaff, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Helper function to convert string to ObjectId
const toObjectId = (id) => {
    try {
        return new mongoose.Types.ObjectId(id);
    } catch (e) {
        return null;
    }
};

// Debug: Log when router is used
router.stack.forEach(function(layer) {
  if (layer.route) {
    console.log('📍 Route registered:', layer.route.stack[0].method.toUpperCase(), layer.route.path);
  }
});

// Business Configuration
const MAX_DAILY_CAPACITY = 200; // Total seats per day
const MAX_DAILY_BOOKINGS = 50; // Maximum number of booking records per day

// Generate unique booking ID
function generateBookingId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

// Check if date is in the past
function isPastDate(dateStr) {
  const selectedDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selectedDate < today;
}

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Public
router.post('/', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('phone').trim().notEmpty().withMessage('Phone is required').matches(/^[\d\s\-\+\(\)]+$/).withMessage('Invalid phone format').isLength({ min: 7, max: 20 }).withMessage('Phone must be 7-20 characters'),
  body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Invalid date format'),
  body(['people', 'guests', 'numberOfSeats']).optional().isInt({ min: 1, max: 1000 }).withMessage('People/Guests/Seats must be between 1 and 1000'),
  body(['group', 'isGroup']).optional().isBoolean().withMessage('Group must be a boolean'),
  body('isAdminOverride').optional().isBoolean().withMessage('isAdminOverride must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { 
      name, 
      phone, 
      date, 
      people, 
      guests,  
      numberOfSeats,
      group = false, 
      isGroup = false,
      isAdminOverride = false  // Admin can override capacity limits
    } = req.body;
    
    // Normalize to single values
    const finalPeople = people || guests || numberOfSeats || 2;
    const finalSeats = numberOfSeats || people || guests || 2;
    const finalGroup = group || isGroup || false;

    // 1. Past Date Protection
    if (isPastDate(date) && !isAdminOverride) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book for past dates',
        error: 'Please select a valid future date for your booking'
      });
    }

    // 2. Check for duplicate booking (same phone + same date)
    const existingBooking = await Booking.findOne({
      phone: phone.replace(/\D/g, ''), // Normalize phone
      date: date,
      status: { $not: /ملغي/ } // Not cancelled
    });

    if (existingBooking && !isAdminOverride) {
      return res.status(409).json({
        success: false,
        message: 'You already have a booking for this date',
        error: 'A booking already exists for this phone number on the selected date'
      });
    }

    // 3. Daily Capacity Limit - Seat-based (200 seats/day)
    // Only for non-admin bookings
    if (!isAdminOverride) {
      // Calculate total seats used by Confirmed and Pending bookings for this date
      const seatAggregation = await Booking.aggregate([
        {
          $match: {
            date: date,
            status: { $in: ['Confirmed', 'Pending'] }
          }
        },
        {
          $group: {
            _id: null,
            totalSeats: { $sum: '$numberOfSeats' }
          }
        }
      ]);
      
      const currentSeatsUsed = seatAggregation.length > 0 ? seatAggregation[0].totalSeats : 0;
      const seatsAfterBooking = currentSeatsUsed + finalSeats;
      
      if (seatsAfterBooking > MAX_DAILY_CAPACITY) {
        const seatsRemaining = Math.max(0, MAX_DAILY_CAPACITY - currentSeatsUsed);
        return res.status(400).json({
          success: false,
          message: 'Capacity reached for this date',
          error: `Capacity reached for this date. Only ${seatsRemaining} seats remaining.`,
          seatsRemaining: seatsRemaining,
          currentSeatsUsed: currentSeatsUsed,
          requestedSeats: finalSeats,
          maxCapacity: MAX_DAILY_CAPACITY
        });
      }
    }

    // 4. Create new booking with all fields
    const now = new Date();
    const booking = new Booking({
      id: generateBookingId(),
      name: name,
      phone: phone,
      date: date,
      guests: finalPeople,
      numberOfSeats: finalSeats,
      isGroup: finalGroup,
      status: 'Pending',
      createdAt: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
    });

    await booking.save();
    console.log(`✅ New booking created: ${booking.id} for ${date} (${finalSeats} seats)`);
    
    // Get updated seat count after booking
    const updatedSeatAggregation = await Booking.aggregate([
      {
        $match: {
          date: date,
          status: { $in: ['Confirmed', 'Pending'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSeats: { $sum: '$numberOfSeats' }
        }
      }
    ]);
    
    const updatedSeatsUsed = updatedSeatAggregation.length > 0 ? updatedSeatAggregation[0].totalSeats : 0;
    
    res.status(201).json({
      success: true,
      message: 'Booking created successfully!',
      bookingId: booking.id || booking._id,
      referenceNumber: booking.referenceNumber, // Short reference number for guests
      data: booking,
      capacity: {
        seatsRemaining: MAX_DAILY_CAPACITY - updatedSeatsUsed,
        currentSeatsUsed: updatedSeatsUsed,
        maxCapacity: MAX_DAILY_CAPACITY
      }
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to create booking', 
      error: error.message 
    });
  }
});

// ==================== ARCHIVE ROUTES (MUST be before /:id routes) ====================

// @route   POST /api/bookings/archive/:id
// @desc    Move a booking to archive (Check-in, No-Show, or Manual archive)
// @access  Private (Admin/Staff)
router.post('/archive/:id', auth, requireStaff, async (req, res) => {
  try {
    const idParam = req.params.id;
    const { archiveReason, notes } = req.body;
    
    // Validate archive reason
    const validReasons = ['Arrived', 'No-Show', 'Cancelled', 'Expired', 'Manual'];
    if (!validReasons.includes(archiveReason)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid archive reason. Must be: Arrived, No-Show, Cancelled, Expired, or Manual' 
      });
    }
    
    // Find the booking (support both numeric id and MongoDB _id)
    let booking;
    const numericId = parseInt(idParam);
    
    // First try: numeric id (local DB format)
    if (!isNaN(numericId)) {
      console.log('🔍 Looking for booking with numeric id:', numericId);
      booking = await Booking.findOne({ id: numericId });
      if (booking) {
        console.log('✅ Found booking by numeric id:', booking.id);
      }
    }
    
    // Second try: MongoDB ObjectId (Atlas format)
    if (!booking && idParam.length === 24) {
      const objectId = toObjectId(idParam);
      if (objectId) {
        console.log('🔍 Looking for booking with ObjectId:', idParam);
        booking = await Booking.findById(objectId);
        if (booking) {
          console.log('✅ Found booking by ObjectId:', booking._id);
        }
      }
    }
    
    if (!booking) {
      console.log('❌ Booking not found for id:', idParam);
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    // Create archive record
    const archiveData = {
      id: booking.id,
      referenceNumber: booking.referenceNumber || `CRT-${booking.id?.toString()?.slice(-4) || Date.now().toString().slice(-4)}`,
      name: booking.name,
      phone: booking.phone,
      date: booking.date,
      guests: booking.guests,
      numberOfSeats: booking.numberOfSeats || booking.guests,
      isGroup: booking.isGroup,
      status: archiveReason === 'Arrived' ? 'Arrived' : 
             archiveReason === 'No-Show' ? 'No-Show' : 
             archiveReason === 'Cancelled' ? 'Cancelled' : 'Expired',
      createdAt: booking.createdAt,
      expiresAt: booking.expiresAt,
      archiveReason: archiveReason,
      archivedAt: new Date(),
      originalReference: booking.referenceNumber || `CRT-${booking.id?.toString()?.slice(-4) || Date.now().toString().slice(-4)}`,
      archivedBy: req.admin ? req.admin.username : 'Staff',
      notes: notes || ''
    };
    
    const archiveEntry = new BookingArchive(archiveData);
    await archiveEntry.save();
    console.log('✅ Archive record created:', archiveEntry._id);
    
    // Delete from active bookings (support both formats)
    let deleteResult;
    if (booking._id && toObjectId(booking._id.toString())) {
      // Has valid ObjectId
      deleteResult = await Booking.deleteOne({ _id: toObjectId(booking._id.toString()) });
    } else {
      // Delete by numeric id
      deleteResult = await Booking.deleteOne({ id: booking.id });
    }
    console.log('🗑️ Delete result:', deleteResult);
    
    console.log(`✅ Booking ${booking.id} archived as '${archiveReason}' by ${archiveData.archivedBy}`);
    
    res.json({
      success: true,
      message: `Booking archived successfully as '${archiveReason}'`,
      data: archiveEntry
    });
    
  } catch (error) {
    console.error('Archive error:', error);
    res.status(500).json({ success: false, message: 'Failed to archive booking', error: error.message });
  }
});

// @route   GET /api/bookings/archive
// @desc    Get all archived bookings with filtering
// @access  Private (Admin only - Full access required)
router.get('/archive', auth, requireAdmin, async (req, res) => {
  try {
    console.log('📂 Archive route hit!');
    const { page = 1, limit = 50, search, reason, startDate, endDate } = req.query;
    const query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Filter by archive reason
    if (reason && reason !== 'All') {
      query.archiveReason = reason;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.archivedAt = {};
      if (startDate) query.archivedAt.$gte = new Date(startDate);
      if (endDate) query.archivedAt.$lte = new Date(endDate);
    }
    
    // Get archived bookings with pagination
    const archives = await BookingArchive.find(query)
      .sort({ archivedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    
    const total = await BookingArchive.countDocuments(query);
    
    // Get stats by archive reason
    const stats = await BookingArchive.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$archiveReason',
          count: { $sum: 1 },
          totalGuests: { $sum: '$guests' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: archives,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total: total
      },
      stats: stats.reduce((acc, item) => {
        acc[item._id] = { count: item.count, totalGuests: item.totalGuests };
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Get archives error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch archives' });
  }
});

// @route   GET /api/bookings/archive/stats
// @desc    Get archive statistics summary
// @access  Private (Admin only - Full access required)
router.get('/archive/stats', auth, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};
    
    if (startDate || endDate) {
      matchStage.archivedAt = {};
      if (startDate) matchStage.archivedAt.$gte = new Date(startDate);
      if (endDate) matchStage.archivedAt.$lte = new Date(endDate);
    }
    
    const stats = await BookingArchive.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$archiveReason',
          count: { $sum: 1 },
          arrived: {
            $sum: { $cond: [{ $eq: ['$archiveReason', 'Arrived'] }, 1, 0] }
          },
          noShow: {
            $sum: { $cond: [{ $eq: ['$archiveReason', 'No-Show'] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$archiveReason', 'Cancelled'] }, 1, 0] }
          },
          expired: {
            $sum: { $cond: [{ $eq: ['$archiveReason', 'Expired'] }, 1, 0] }
          },
          totalGuestsServed: {
            $sum: { $cond: [{ $eq: ['$archiveReason', 'Arrived'] }, '$guests', 0] }
          }
        }
      }
    ]);
    
    const result = {};
    stats.forEach(stat => {
      result[stat._id] = {
        count: stat.count,
        arrived: stat.arrived,
        noShow: stat.noShow,
        cancelled: stat.cancelled,
        expired: stat.expired,
        totalGuestsServed: stat.totalGuestsServed
      };
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Archive stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get archive stats' });
  }
});

// ==================== RESTORE ROUTES ====================

// @route   POST /api/bookings/restore/:id
// @desc    Restore an archived booking back to active bookings
// @access  Private (Admin only)
router.post('/restore/:id', auth, requireAdmin, async (req, res) => {
  try {
    const idParam = req.params.id;
    const adminId = req.user?.id || req.user?._id;
    
    console.log('🔄 Restore request - id:', idParam);
    
    // Determine if this is from Booking collection or BookingArchive collection
    // Check if idParam is a valid MongoDB ObjectId (24 chars)
    const isMongoId = idParam.length === 24 && /^[a-f0-9]+$/i.test(idParam);
    
    let archivedBooking;
    let sourceCollection = '';
    
    if (isMongoId) {
      // Try BookingArchive first (most common for archived items)
      const objectId = toObjectId(idParam);
      if (objectId) {
        console.log('🔍 Searching in BookingArchive by ObjectId:', idParam);
        archivedBooking = await BookingArchive.findById(objectId);
        if (archivedBooking) {
          console.log('✅ Found in BookingArchive:', archivedBooking._id);
          sourceCollection = 'archive';
        }
      }
      
      // If not found, try Booking collection
      if (!archivedBooking) {
        console.log('🔍 Searching in Booking by ObjectId:', idParam);
        archivedBooking = await Booking.findById(objectId);
        if (archivedBooking) {
          console.log('✅ Found in Booking:', archivedBooking._id);
          sourceCollection = 'booking';
        }
      }
    } else {
      // Try numeric id in Booking collection
      const numericId = parseInt(idParam);
      if (!isNaN(numericId)) {
        console.log('🔍 Searching in Booking by numeric id:', numericId);
        archivedBooking = await Booking.findOne({ id: numericId });
        if (archivedBooking) {
          console.log('✅ Found in Booking by numeric id:', archivedBooking.id);
          sourceCollection = 'booking';
        }
      }
      
      // Try referenceNumber
      if (!archivedBooking && /^CRT-[A-Z0-9]{4}$/i.test(idParam)) {
        const refUpper = idParam.toUpperCase();
        console.log('🔍 Searching by referenceNumber:', refUpper);
        
        // Search in both collections
        archivedBooking = await BookingArchive.findOne({ referenceNumber: refUpper });
        if (archivedBooking) {
          console.log('✅ Found in BookingArchive by referenceNumber:', archivedBooking.referenceNumber);
          sourceCollection = 'archive';
        } else {
          archivedBooking = await Booking.findOne({ referenceNumber: refUpper });
          if (archivedBooking) {
            console.log('✅ Found in Booking by referenceNumber:', archivedBooking.referenceNumber);
            sourceCollection = 'booking';
          }
        }
      }
    }
    
    if (!archivedBooking) {
      console.log('❌ Booking not found for id:', idParam);
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found in archives' 
      });
    }
    
    console.log('📦 Source collection:', sourceCollection);
    console.log('📋 Booking data:', {
      referenceNumber: archivedBooking.referenceNumber,
      name: archivedBooking.name,
      status: archivedBooking.status
    });
    
    // Check which collection the booking came from
    const fromArchive = sourceCollection === 'archive';
    
    if (fromArchive) {
      // Booking came from BookingArchive collection - restore it
      console.log('📦 Restoring from BookingArchive collection');
      
      // Create a new active booking from the archived data
      const restoredBooking = new Booking({
        id: generateBookingId(), // Generate unique numeric ID
        referenceNumber: archivedBooking.referenceNumber,
        name: archivedBooking.name || (archivedBooking.firstName && archivedBooking.lastName ? archivedBooking.firstName + ' ' + archivedBooking.lastName : archivedBooking.firstName || archivedBooking.lastName || 'Unknown'),
        phone: archivedBooking.phone,
        email: archivedBooking.email || '',
        date: archivedBooking.date,
        time: archivedBooking.time,
        guests: archivedBooking.guests || archivedBooking.numberOfSeats || 1,
        numberOfSeats: archivedBooking.numberOfSeats || archivedBooking.guests || 1,
        status: 'Confirmed', // Restore as Confirmed by default
        notes: archivedBooking.notes || '',
        specialRequests: archivedBooking.specialRequests || '',
        createdAt: new Date(), // New creation date
        restoredFromArchive: true,
        originalArchiveId: archivedBooking._id,
        restoredBy: adminId,
        restoredAt: new Date()
      });
      
      await restoredBooking.save();
      console.log('✅ New booking created:', restoredBooking.id);
      
      // Remove from BookingArchive
      const deleteResult = await BookingArchive.deleteOne({ _id: toObjectId(archivedBooking._id.toString()) });
      console.log('🗑️ Archive entry deleted:', deleteResult);
      
      console.log('✅ Booking restored successfully:', {
        originalId: archivedBooking._id,
        restoredId: restoredBooking._id,
        referenceNumber: restoredBooking.referenceNumber,
        restoredBy: adminId
      });
      
      res.json({
        success: true,
        message: 'Booking restored successfully from archive',
        data: restoredBooking
      });
    } else {
      // Booking came from Booking collection - just update its status
      console.log('📦 Updating existing booking in Booking collection');
      
      // Update the booking to make it active again
      archivedBooking.status = 'Confirmed';
      archivedBooking.archived = false;
      archivedBooking.archivedAt = null;
      archivedBooking.archiveReason = null;
      archivedBooking.restoredFromArchive = true;
      archivedBooking.restoredBy = adminId;
      archivedBooking.restoredAt = new Date();
      
      await archivedBooking.save();
      
      console.log('✅ Booking updated successfully:', archivedBooking.id);
      
      res.json({
        success: true,
        message: 'Booking restored successfully',
        data: archivedBooking
      });
    }
  } catch (error) {
    console.error('Restore booking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to restore booking: ' + error.message 
    });
  }
});

// ==================== END RESTORE ROUTES ====================

// ==================== END ARCHIVE ROUTES ====================

// @route   GET /api/bookings
// @desc    Get all bookings
// @access  Private (Admin only)
router.get('/', auth, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 }); // Show newest first
    res.json({
      success: true,
      data: bookings
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get booking by ID (supports: numeric id, MongoDB _id, and referenceNumber)
// @access  Public (for check-status page)
router.get('/:id', async (req, res) => {
  try {
    let booking;
    const searchId = req.params.id.trim();
    
    console.log('🔍 Searching for booking:', searchId);
    
    // 1. Try to find by referenceNumber (e.g., CRT-XXXX)
    if (/^CRT-[A-Z0-9]{4}$/i.test(searchId)) {
      console.log('📋 Searching by referenceNumber:', searchId.toUpperCase());
      booking = await Booking.findOne({ referenceNumber: searchId.toUpperCase() });
      if (booking) console.log('✅ Found by referenceNumber:', booking.referenceNumber);
    }
    
    // 2. If not found, try numeric id
    if (!booking) {
      const numericId = parseInt(searchId);
      if (!isNaN(numericId)) {
        console.log('🔢 Searching by numeric id:', numericId);
        booking = await Booking.findOne({ id: numericId });
        if (booking) console.log('✅ Found by numeric id:', booking.id);
      }
    }
    
    // 3. If not found, try MongoDB ObjectId
    if (!booking && searchId.length === 24) {
      const objectId = toObjectId(searchId);
      if (objectId) {
        console.log('🆔 Searching by ObjectId:', searchId);
        booking = await Booking.findById(objectId);
        if (booking) console.log('✅ Found by ObjectId:', booking._id);
      }
    }
    
    if (!booking) {
      console.log('❌ Booking not found:', searchId);
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    res.json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/bookings/:id
// @desc    Update booking status
// @access  Private (Admin or Staff)
router.put('/:id', auth, requireStaff, async (req, res) => {
  try {
    let booking;
    const idParam = req.params.id;
    const { status } = req.body;
    
    const validStatuses = ['Pending', 'Confirmed', 'Cancelled', 'Arrived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status. Must be: Pending, Confirmed, Cancelled, or Arrived' });
    }
    
    // Build update object
    const updateObj = { 
      status: status,
      cancelledAt: status === 'Cancelled' ? new Date() : null
    };
    
    // If cancelling, set archived flag
    if (status === 'Cancelled') {
      updateObj.archived = true;
      updateObj.archivedAt = new Date();
      updateObj.archiveReason = 'Manual cancellation';
    }
    
    // Try to find by numeric id first
    const numericId = parseInt(idParam);
    if (!isNaN(numericId)) {
      console.log('🔄 Updating booking by numeric id:', numericId);
      booking = await Booking.findOneAndUpdate(
        { id: numericId },
        updateObj,
        { new: true }
      );
    }
    
    // If not found by numeric id, try MongoDB ObjectId
    if (!booking && idParam.length === 24) {
      const objectId = toObjectId(idParam);
      if (objectId) {
        console.log('🔄 Updating booking by ObjectId:', idParam);
        booking = await Booking.findByIdAndUpdate(
          objectId,
          updateObj,
          { new: true }
        );
      }
    }
    
    if (!booking) {
      console.log('❌ Booking not found for update:', idParam);
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    console.log('✅ Booking status updated:', booking.id || booking._id, '->', status);
    res.json({ 
      success: true, 
      message: 'Booking status updated successfully!',
      data: booking
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// @route   DELETE /api/bookings/:id
// @desc    Delete booking (permanent)
// @access  Private (Admin or SuperAdmin only)
router.delete('/:id', auth, requireAdmin, async (req, res) => {
  try {
    let booking;
    const idParam = req.params.id;
    
    console.log('🗑️ Attempting to delete booking:', idParam);
    
    // Try to find by numeric id first
    const numericId = parseInt(idParam);
    if (!isNaN(numericId)) {
      console.log('🔍 Looking for booking with numeric id:', numericId);
      booking = await Booking.findOneAndDelete({ id: numericId });
      if (booking) {
        console.log('✅ Found booking by numeric id:', booking.id);
      }
    }
    
    // If not found by numeric id, try MongoDB ObjectId
    if (!booking && idParam.length === 24) {
      const objectId = toObjectId(idParam);
      if (objectId) {
        console.log('🔍 Looking for booking with ObjectId:', idParam);
        booking = await Booking.findByIdAndDelete(objectId);
        if (booking) {
          console.log('✅ Found booking by ObjectId:', booking._id);
        }
      }
    }
    
    if (!booking) {
      console.log('❌ Booking not found for deletion:', idParam);
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    
    console.log('✅ Booking deleted:', booking.id || booking._id);
    res.json({ 
      success: true, 
      message: 'Booking deleted successfully!',
      data: { id: booking.id || booking._id }
    });
  } catch (error) {
    console.error('Delete booking error:', error);
    res.status(500).json({ success: false, message: 'Server error: ' + error.message });
  }
});

// @route   GET /api/bookings/check/:phone/:date
// @desc    Check for duplicate booking
// @access  Public
router.get('/check/:phone/:date', async (req, res) => {
  try {
    const { phone, date } = req.params;
    
    const normalizedPhone = phone.replace(/\D/g, '');
    const bookingDate = new Date(date);
    
    // Normalize the booking date to midnight
    bookingDate.setHours(0, 0, 0, 0);
    
    const existingBooking = await Booking.findOne({
      phone: normalizedPhone,
      status: { $not: /ملغي/ } // Not cancelled
    });
    
    if (existingBooking) {
      // Check if date is close to the requested date
      const existingDate = new Date(existingBooking.date);
      existingDate.setHours(0, 0, 0, 0);
      
      const diffTime = Math.abs(existingDate - bookingDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 1) {
        return res.json({ 
          exists: true, 
          message: 'A booking already exists for this phone number on the selected date',
          booking: existingBooking
        });
      }
    }
    
    res.json({ exists: false });
  } catch (error) {
    console.error('Check booking error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/bookings/availability/:date
// @desc    Get available capacity for a specific date
// @access  Public
router.get('/availability/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Calculate total seats used by Confirmed and Pending bookings for this date
    const seatAggregation = await Booking.aggregate([
      {
        $match: {
          date: date,
          status: { $in: ['Confirmed', 'Pending'] }
        }
      },
      {
        $group: {
          _id: null,
          totalSeats: { $sum: '$numberOfSeats' },
          totalBookings: { $sum: 1 }
        }
      }
    ]);
    
    const currentSeatsUsed = seatAggregation.length > 0 ? seatAggregation[0].totalSeats : 0;
    const totalBookings = seatAggregation.length > 0 ? seatAggregation[0].totalBookings : 0;
    const seatsRemaining = Math.max(0, MAX_DAILY_CAPACITY - currentSeatsUsed);
    
    res.json({
      success: true,
      data: {
        date: date,
        seatsRemaining: seatsRemaining,
        currentSeatsUsed: currentSeatsUsed,
        maxCapacity: MAX_DAILY_CAPACITY,
        totalBookings: totalBookings,
        available: seatsRemaining > 0
      }
    });
  } catch (error) {
    console.error('Get availability error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
