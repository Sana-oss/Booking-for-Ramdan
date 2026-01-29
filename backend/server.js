const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ربط مسارات المصادقة (Authentication Routes)
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Middleware للمصادقة
const { auth, requireAdmin } = require('./middleware/auth');
const Admin = require('./models/Admin');

// 1. الاتصال بقاعدة البيانات (MongoDB)
mongoose.connect('mongodb://localhost:27017/corinthiaDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// 2. تعريف هيكل الحجز (Schema)
const bookingSchema = new mongoose.Schema({
    name: String,
    phone: String,
    date: Date,
    guests: Number,
    status: { type: String, default: 'Pending' } // الحالة الافتراضية
});

const Booking = mongoose.model('Booking', bookingSchema);

// --- المسارات (Routes) ---

// [أ] للزبائن: إنشاء حجز جديد
app.post('/api/bookings', async (req, res) => {
    try {
        const newBooking = new Booking(req.body);
        await newBooking.save();
        res.json({ success: true, bookingId: newBooking._id });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// [ب] للزبائن: الاستعلام عن حجز محدد
app.get('/api/bookings/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (booking) {
            res.json({ success: true, data: booking });
        } else {
            res.status(404).json({ success: false, message: "Booking not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Invalid ID format" });
    }
});

// [ج] للإدارة: جلب كافة الحجوزات (الجديد ✨)
app.get('/api/bookings', async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ date: -1 }); // عرض الأحدث أولاً
        res.json({ success: true, data: bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// [د] للإدارة: تحديث حالة الحجز (الجديد ✨)
app.patch('/api/bookings/:id', async (req, res) => {
    try {
        const { status } = req.body;
        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id, 
            { status: status }, 
            { new: true }
        );
        res.json({ success: true, data: updatedBooking });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// [هـ] للإدارة: حذف حجز (الجديد ✨)
app.delete('/api/bookings/:id', async (req, res) => {
    try {
        await Booking.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Booking deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- مسارات إدارة المستخدمين (Admin Only) ---

// [1] جلب جميع المستخدمين (Admin Only)
app.get('/api/users', auth, requireAdmin, async (req, res) => {
    try {
        const users = await Admin.find().select('-password').sort({ createdAt: -1 });
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// [2] إنشاء مستخدم جديد (Admin Only)
app.post('/api/users', auth, requireAdmin, async (req, res) => {
    try {
        const { username, password, name, role } = req.body;
        
        // التحقق من البيانات المطلوبة
        if (!username || !password || !name) {
            return res.status(400).json({ success: false, message: 'Username, password, and name are required' });
        }
        
        // التحقق من عدم وجود مستخدم بنفس الاسم
        const existing = await Admin.findOne({ username: username.toLowerCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }
        
        // إنشاء المستخدم (سيتم تشفير كلمة المرور تلقائياً بواسطة Schema)
        const newUser = new Admin({
            username: username.toLowerCase(),
            password,
            name,
            role: role || 'staff',
            isActive: true
        });
        
        await newUser.save();
        
        // إرجاع البيانات بدون كلمة المرور
        const userData = newUser.toJSON();
        res.json({ success: true, data: userData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// [3] حذف مستخدم (Admin Only)
app.delete('/api/users/:id', auth, requireAdmin, async (req, res) => {
    try {
        // منع حذف المستخدم الحالي
        if (req.params.id === req.admin._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }
        
        await Admin.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// تشغيل السيرفر
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});