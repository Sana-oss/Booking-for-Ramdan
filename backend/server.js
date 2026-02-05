const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const frontendPath = path.join(__dirname, '..', 'frontend');

// ============================================
// 1. MIDDLEWARES (First - Apply to all requests)
// ============================================
app.use(cors());
app.use(bodyParser.json());

// ============================================
// 2. API ROUTES (Second - Must come before static files)
// ============================================

// Security imports (after bodyParser)
const security = require('./security-validation');
app.use(security.nosqlInjectionProtection.protect);
app.use(security.xssProtection.protect);

// Auth routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Booking routes
try {
    const bookingRoutes = require('./routes/bookings');
    console.log('✅ Booking routes loaded, stack length:', bookingRoutes.stack.length);
    app.use('/api/bookings', bookingRoutes);
} catch(e) {
    console.error('❌ ERROR loading booking routes:', e.message);
    console.error(e.stack);
}

// DEBUG: Show all registered routes
setTimeout(function() {
    console.log('\n=== REGISTERED ROUTES ===');
    
    // Check main router for routes
    app._router.stack.forEach(function(r) {
        if (r.route && r.route.path) {
            var methods = Object.keys(r.route.methods).map(function(m) { return m.toUpperCase(); }).join(',');
            console.log('  ' + methods.padEnd(8) + r.route.path);
        }
    });
    
    // Check for mounted routers
    app._router.stack.forEach(function(r) {
        if (r.name === 'router' && r.handle.stack) {
            r.handle.stack.forEach(function(sr) {
                if (sr.route && sr.route.path) {
                    var methods = Object.keys(sr.route.methods).map(function(m) { return m.toUpperCase(); }).join(',');
                    var basePath = r.regexp ? '/api/bookings' : '';
                    console.log('  ' + methods.padEnd(8) + basePath + sr.route.path + ' (MOUNTED)');
                }
            });
        }
    });
    
    console.log('========================\n');
}, 500);

// Middleware for auth
const { auth, requireAdmin } = require('./middleware/auth');
const Admin = require('./models/Admin');
const Booking = require('./models/Booking');
const BookingArchive = require('./models/BookingArchive');

// Inject Booking model into security module
security.setBookingModel(Booking);

// --- Analytics Dashboard Data ---
app.get('/api/admin/analytics', auth, async (req, res) => {
    try {
        console.log('📊 Processing analytics request...');
        
        // 1. Booking Status Distribution
        const statusDistribution = await Booking.aggregate([
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);
        console.log('✅ Status distribution:', statusDistribution);
        
        // 2. Weekly Trends (Last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const weeklyTrends = await Booking.aggregate([
            { 
                $match: { 
                    $or: [
                        { createdAt: { $gte: sevenDaysAgo } },
                        { createdAt: { $exists: false } }
                    ]
                } 
            },
            {
                $group: {
                    _id: { 
                        $dateToString: { 
                            format: "%Y-%m-%d", 
                            date: { $ifNull: ["$createdAt", new Date()] } 
                        } 
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        console.log('✅ Weekly trends:', weeklyTrends);
        
        // 3. Calculate Total Revenue (based on seats - assume average seat value)
        const revenueAggregation = await Booking.aggregate([
            { $match: { status: { $in: ['Confirmed', 'Pending'] } } },
            {
                $group: {
                    _id: null,
                    totalSeats: { $sum: '$numberOfSeats' },
                    totalBookings: { $sum: 1 }
                }
            }
        ]);
        
        const totalSeatsBooked = revenueAggregation.length > 0 ? revenueAggregation[0].totalSeats : 0;
        const totalBookingsCount = revenueAggregation.length > 0 ? revenueAggregation[0].totalBookings : 0;
        
        // Calculate revenue (assuming average 50 LYD per seat)
        const AVERAGE_SEAT_PRICE = 50; // LYD
        const totalRevenue = totalSeatsBooked * AVERAGE_SEAT_PRICE;
        
        console.log('✅ Revenue calculated:', { totalSeatsBooked, totalBookingsCount, totalRevenue });
        
        res.json({
            success: true,
            data: {
                statusDistribution: statusDistribution,
                weeklyTrends: weeklyTrends,
                summary: {
                    totalRevenue: totalRevenue,
                    totalBookings: totalBookingsCount,
                    totalSeats: totalSeatsBooked,
                    averagePerBooking: totalBookingsCount > 0 ? Math.round(totalSeatsBooked / totalBookingsCount) : 0
                }
            }
        });
    } catch (error) {
        console.error('❌ Analytics error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Analytics processing failed: ' + error.message 
        });
    }
});

// --- Daily Capacity Overview (for admin dashboard) ---
app.get('/api/admin/capacity', auth, async (req, res) => {
    try {
        console.log('📊 Processing capacity overview request...');
        
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0); // Start from today (midnight)
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + parseInt(days));
        
        // Get capacity data for each date
        const capacityData = await Booking.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate.toISOString().split('T')[0],
                        $lte: endDate.toISOString().split('T')[0]
                    },
                    status: { $in: ['Confirmed', 'Pending'] }
                }
            },
            {
                $group: {
                    _id: '$date',
                    totalSeats: { $sum: '$numberOfSeats' },
                    bookingCount: { $sum: 1 },
                    pendingCount: { 
                        $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] } 
                    },
                    confirmedCount: { 
                        $sum: { $cond: [{ $eq: ['$status', 'Confirmed'] }, 1, 0] } 
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);
        
        const MAX_DAILY_CAPACITY = 200;
        
        // Format response with warnings for capacity > 80%
        const formattedData = capacityData.map(day => {
            const percentage = Math.round((day.totalSeats / MAX_DAILY_CAPACITY) * 100);
            return {
                date: day._id,
                totalSeats: day.totalSeats,
                seatsRemaining: MAX_DAILY_CAPACITY - day.totalSeats,
                bookingCount: day.bookingCount,
                pendingCount: day.pendingCount,
                confirmedCount: day.confirmedCount,
                maxCapacity: MAX_DAILY_CAPACITY,
                capacityPercentage: percentage,
                isWarning: percentage >= 80,
                isFull: day.totalSeats >= MAX_DAILY_CAPACITY
            };
        });
        
        console.log('✅ Capacity overview:', formattedData.length, 'days analyzed');
        
        res.json({
            success: true,
            data: {
                dailyCapacity: formattedData,
                maxCapacity: MAX_DAILY_CAPACITY,
                warningThreshold: 80
            }
        });
    } catch (error) {
        console.error('❌ Capacity overview error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Capacity overview failed: ' + error.message 
        });
    }
});

// --- Get Archived/Cancelled Bookings (for archives page) ---
// Also fetches from BookingArchive collection for restored items
app.get('/api/admin/archived-bookings', auth, async (req, res) => {
    try {
        // Fetch from Booking collection (cancelled/expired from main collection)
        const fromBookingRaw = await Booking.find({
            $or: [
                { archived: true },
                { status: { $in: ['Cancelled', 'Expired', 'No-Show', 'Arrived'] } }
            ]
        }).sort({ updatedAt: -1 }).lean();
        
        const fromBooking = fromBookingRaw.map(b => ({
            _id: b._id,
            id: b.id,
            referenceNumber: b.referenceNumber,
            name: b.name,
            phone: b.phone,
            date: b.date,
            guests: b.guests,
            status: b.status,
            archived: b.archived,
            archiveReason: b.archiveReason,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,
            _source: 'booking'
        }));
        
        // Fetch from BookingArchive collection (explicitly archived items)
        const fromArchiveRaw = await BookingArchive.find({}).sort({ archivedAt: -1 }).lean();
        
        const fromArchive = fromArchiveRaw.map(b => ({
            _id: b._id,
            id: b.id,
            referenceNumber: b.referenceNumber,
            name: b.name,
            phone: b.phone,
            date: b.date,
            guests: b.guests,
            status: b.status,
            archiveReason: b.archiveReason,
            archivedAt: b.archivedAt,
            createdAt: b.createdAt,
            _source: 'archive'
        }));
        
        // Combine both sources
        const combined = [...fromBooking, ...fromArchive];
        
        // Remove duplicates based on referenceNumber or id
        const seen = new Set();
        const unique = combined.filter(item => {
            const key = item.referenceNumber || item.id || String(item._id);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        
        console.log(`📦 Loaded ${fromBooking.length} from Booking, ${fromArchive.length} from Archive, ${unique.length} unique`);
        
        res.json({ success: true, data: unique });
    } catch (error) {
        console.error('❌ Archived bookings fetch error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch archived bookings: ' + error.message 
        });
    }
});

// ============================================
// AUTO-CANCELLATION BACKGROUND TASK
// Runs every 10 minutes to cancel expired Pending bookings
// This is the server-side safety net for the 24-hour rule
// ============================================
const autoCancelExpiredBookings = async () => {
    try {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        console.log('🔄 [Auto-Cleanup] Checking for expired bookings...');
        
        // Find and cancel all Pending bookings older than 24 hours
        const result = await Booking.updateMany(
            { 
                status: 'Pending', 
                createdAt: { $lt: twentyFourHoursAgo }
            },
            { 
                $set: { 
                    status: 'Cancelled', 
                    cancellationReason: 'Auto-expired after 24 hours',
                    autoCancelled: true,
                    cancelledAt: now,
                    archived: true,
                    archivedAt: now,
                    archiveReason: 'Auto-expiry'
                } 
            }
        );
        
        if (result.modifiedCount > 0) {
            console.log(`✅ [Auto-Cleanup]: ${result.modifiedCount} expired bookings were cancelled and archived.`);
        } else {
            console.log('📋 [Auto-Cleanup]: No expired bookings found.');
        }
        
        return result.modifiedCount;
    } catch (err) {
        console.error('[Cleanup Error]:', err);
        return 0;
    }
};

// Schedule auto-cancellation to run every 10 minutes
setInterval(autoCancelExpiredBookings, 10 * 60 * 1000);

// Also run on server start to catch any missed expirations
autoCancelExpiredBookings();

console.log('✅ Auto-cancellation scheduled: runs every 10 minutes');

// --- Users Management (Admin Only) ---
app.get('/api/admin/users', auth, requireAdmin, async (req, res) => {
    try {
        const users = await Admin.find({}, '-password');
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post('/api/admin/users', auth, requireAdmin, async (req, res) => {
    try {
        const { username, name, password, role } = req.body;
        
        const existingUser = await Admin.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        
        const newAdmin = new Admin({
            username,
            name,
            password,
            role: role || 'staff',
            isActive: true
        });
        
        await newAdmin.save();
        
        res.json({
            success: true,
            message: 'User created successfully',
            data: {
                _id: newAdmin._id,
                username: newAdmin.username,
                name: newAdmin.name,
                role: newAdmin.role,
                isActive: newAdmin.isActive
            }
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.delete('/api/admin/users/:id', auth, requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id;
        
        const userToDelete = await Admin.findById(userId);
        if (!userToDelete) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const adminCount = await Admin.countDocuments({ role: 'admin' });
        if (userToDelete.role === 'admin' && adminCount <= 1) {
            return res.status(400).json({ success: false, message: 'Cannot delete last admin' });
        }
        
        await Admin.findByIdAndDelete(userId);
        
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- Health Check ---
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// ============================================
// 3. STATIC FILES (Third - Serve frontend assets)
// ============================================
app.use(express.static(frontendPath));

// ============================================
// 4. HTML PAGE ROUTES (Fourth - Specific pages)
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(frontendPath, 'admin-dashboard.html'));
});

app.get('/check-status', (req, res) => {
    res.sendFile(path.join(frontendPath, 'check-status.html'));
});

app.get('/success', (req, res) => {
    res.sendFile(path.join(frontendPath, 'success.html'));
});

app.get('/admin-login', (req, res) => {
    res.sendFile(path.join(frontendPath, 'admin-login.html'));
});

app.get('/archives', (req, res) => {
    res.sendFile(path.join(frontendPath, 'archives.html'));
});

app.get('/users-management', (req, res) => {
    res.sendFile(path.join(frontendPath, 'users-management.html'));
});

// ============================================
// 5. CATCH-ALL ROUTE (Last - Must be after all other routes)
// ============================================
app.get('*', (req, res) => {
    // For API routes that don't exist, return 404 JSON
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ 
            success: false, 
            message: 'API endpoint not found',
            path: req.path
        });
    } else {
        // For non-API routes, serve the main page (SPA style)
        res.sendFile(path.join(frontendPath, 'index.html'));
    }
});

// ============================================
// DATABASE CONNECTION
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/corinthiaDB';
console.log('🔗 Connecting to MongoDB:', MONGODB_URI);

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'CorinthiaDB'
}).then(() => console.log("✅ Connected to MongoDB - CorinthiaDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ Global Error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('🔒 Security middleware active: NoSQL Injection & XSS Protection');
    console.log('📋 Route order: Middlewares → API → Static → HTML Pages → Catch-all');
});

